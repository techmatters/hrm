/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

/* eslint-disable jest/no-standalone-expect,no-await-in-loop */

import each from 'jest-each';

import { CaseService, createCase } from '@tech-matters/hrm-core/case/caseService';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';

import * as mocks from '../mocks';
import { headers, getRequest, getServer, setRules, useOpenRules } from '../server';
import { ALWAYS_CAN } from '../mocks';
import { TKConditionsSets } from '@tech-matters/hrm-core/permissions/rulesMap';
import {
  connectContactToCase,
  createContact,
} from '@tech-matters/hrm-core/contact/contactService';
import { randomUUID } from 'crypto';
import { clearAllTables } from '../dbCleanup';
import { addMinutes, isAfter, subDays, subHours } from 'date-fns';
import { WorkerSID } from '@tech-matters/types';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { accountSid, workerSid } = mocks;
const otherWorkerSid = 'WK-wa-wa-west';

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
});

beforeEach(async () => {
  await mockSuccessfulTwilioAuthentication(workerSid);
});

const route = `/v0/accounts/${accountSid}/cases`;

describe('isCaseContactOwner condition', () => {
  const newCaseDescriptionSet = (user: typeof workerSid | typeof otherWorkerSid) => {
    const ownerDescription = `case created by ${
      user === workerSid ? 'this user' : 'other user'
    }` as const;
    return [
      `${ownerDescription}, with no contact`,
      `${ownerDescription}, with other contact`,
      `${ownerDescription}, with owned contact`,
    ] as const;
  };

  const caseDescriptions = {
    [workerSid]: newCaseDescriptionSet(workerSid),
    [otherWorkerSid]: newCaseDescriptionSet(otherWorkerSid),
  };
  let sampleCases: CaseService[];
  beforeEach(async () => {
    useOpenRules();
    sampleCases = [];
    for (const user of [workerSid, otherWorkerSid] as WorkerSID[]) {
      const newCases = await Promise.all(
        caseDescriptions[user].map(desc =>
          createCase({ info: { summary: desc } }, accountSid, user, undefined, true),
        ),
      );
      const [, caseWithOtherContact, caseWithOwnedContact] = newCases;
      const [ownedContact, otherContact] = await Promise.all(
        [workerSid, otherWorkerSid].map((contactUser: WorkerSID) =>
          createContact(
            accountSid,
            'WK-creator-not-relevant',
            {
              twilioWorkerId: contactUser,
              taskId: `TK${randomUUID()}`,
              rawJson: {
                categories: {},
                callerInformation: {},
                childInformation: {},
                caseInformation: {},
                callType: 'x',
              },
              queueName: 'buh',
              conversationDuration: 0,
            },
            ALWAYS_CAN,
            true,
          ),
        ),
      );
      await Promise.all([
        connectContactToCase(
          accountSid,
          ownedContact.id.toString(),
          caseWithOwnedContact.id.toString(),
          ALWAYS_CAN,
          true,
        ),
        connectContactToCase(
          accountSid,
          otherContact.id.toString(),
          caseWithOtherContact.id.toString(),
          ALWAYS_CAN,
          true,
        ),
      ]);
      sampleCases.push(...newCases);
    }
  });

  afterEach(clearAllTables);

  test('stub', () => {});

  type TestCase = {
    permissions: TKConditionsSets<'case'>;
    expectedPermittedCases: string[];
    userIsSupervisor?: boolean;
  };

  const testCases: TestCase[] = [
    {
      permissions: [['everyone']],
      expectedPermittedCases: Object.values(caseDescriptions).flat(),
    },
    {
      permissions: [['isCaseContactOwner']],
      expectedPermittedCases: [
        'case created by other user, with owned contact',
        'case created by this user, with owned contact',
      ],
    },
    {
      permissions: [['isCaseContactOwner', 'isCreator']],
      expectedPermittedCases: ['case created by this user, with owned contact'],
    },
    {
      permissions: [['isCaseContactOwner'], ['isCreator']],
      expectedPermittedCases: [
        'case created by other user, with owned contact',
        'case created by this user, with owned contact',
        'case created by this user, with no contact',
        'case created by this user, with other contact',
      ],
    },
    {
      permissions: [['isCaseContactOwner', 'isSupervisor']],
      expectedPermittedCases: [],
    },
    {
      permissions: [['isCaseContactOwner'], ['isSupervisor']],
      expectedPermittedCases: [
        'case created by other user, with owned contact',
        'case created by this user, with owned contact',
      ],
    },
    {
      permissions: [['isCaseContactOwner'], ['isSupervisor']],
      expectedPermittedCases: Object.values(caseDescriptions).flat(),
      userIsSupervisor: true,
    },
    {
      permissions: [['isCreator'], ['isSupervisor']],
      expectedPermittedCases: Object.values(caseDescriptions).flat(),
      userIsSupervisor: true,
    },
    {
      permissions: [['isCreator', 'isSupervisor']],
      expectedPermittedCases: [
        'case created by this user, with owned contact',
        'case created by this user, with no contact',
        'case created by this user, with other contact',
      ],
      userIsSupervisor: true,
    },
  ];

  describe('/cases/:id route - GET', () => {
    const testCasesWithDescriptions = testCases.map(tc => ({
      ...tc,
      description: `cases ${tc.expectedPermittedCases
        .map(desc => `[${desc}]`)
        .join(', ')} should be permitted when VIEW_CASE permissions are ${JSON.stringify(
        tc.permissions,
      )} and user is ${tc.userIsSupervisor ? 'a supervisor' : 'not a supervisor'}`,
    }));
    each(testCasesWithDescriptions).test(
      '$description',
      async ({ permissions, expectedPermittedCases, userIsSupervisor }: TestCase) => {
        const subRoute = id => `${route}/${id}`;
        setRules({ viewCase: permissions });
        if (userIsSupervisor) {
          await mockSuccessfulTwilioAuthentication(workerSid, ['supervisor']);
        }
        const responses = await Promise.all(
          sampleCases.map(async c => request.get(subRoute(c.id)).set(headers)),
        );
        const permitted = responses
          .filter(({ status }) => {
            if (status === 200) return true;
            expect(status).toBe(404);
            return false;
          })
          .map(r => r.body);
        expect(permitted.map(p => p.info.summary).sort()).toEqual(
          expectedPermittedCases.sort(),
        );
      },
    );
  });
  describe('cases/search route - POST', () => {
    const testCasesWithDescriptions = testCases.map(tc => ({
      ...tc,
      description: `cases ${tc.expectedPermittedCases
        .map(desc => `[${desc}]`)
        .join(
          ', ',
        )} should be returned in searches when VIEW_CASE permissions are ${JSON.stringify(
        tc.permissions,
      )} and user is ${tc.userIsSupervisor ? 'a supervisor' : 'not a supervisor'}`,
    }));
    each(testCasesWithDescriptions).test(
      '$description',
      async ({ permissions, expectedPermittedCases, userIsSupervisor }: TestCase) => {
        setRules({ viewCase: permissions });
        if (userIsSupervisor) {
          await mockSuccessfulTwilioAuthentication(workerSid, ['supervisor']);
        }
        const expectedIds = expectedPermittedCases.sort();
        const {
          body: { cases, count },
          status,
        } = await request.post(`${route}/search`).set(headers);
        expect(status).toBe(200);
        expect(cases.map(c => c.info.summary).sort()).toEqual(expectedIds);
        expect(count).toBe(expectedPermittedCases.length);
      },
    );
  });
});

describe('Time based condition', () => {
  let sampleCases: CaseService[];
  // Not great to be using the current time from a determinism standpoint.
  // Unfortunately, faking out the date & time with Jest borks the DB client when interacting with a DB container still using the correct time
  // The alternative is to add lots of 'for testing' injection points for dates, but this seems like it could be abused or broken easily
  // This way we only need to add one injection point for the current time, and that's on an internal function that's not exposed to the outside world.
  const BASELINE_DATE = new Date();
  const caseCreatedTimes = [
    subDays(BASELINE_DATE, 3),
    subDays(BASELINE_DATE, 2),
    subDays(BASELINE_DATE, 1),
    subHours(BASELINE_DATE, 12),
    subHours(BASELINE_DATE, 9),
    subHours(BASELINE_DATE, 6),
  ].sort();

  const BASELINE_DATE_FOR_VALIDATION = addMinutes(BASELINE_DATE, 10);

  beforeEach(async () => {
    useOpenRules();
    sampleCases = [];
    for (const [idx, createdAt] of Object.entries(caseCreatedTimes)) {
      const newCase = await createCase(
        {
          info: { summary: 'case' },
          status: parseInt(idx) % 2 === 1 ? 'open' : 'closed',
        },
        accountSid,
        workerSid,
        createdAt,
        true,
      );
      sampleCases.push(newCase);
    }
  });

  afterEach(async () => {
    jest.useRealTimers();
    await clearAllTables();
  });

  type TestCase = {
    description: string;
    permissions: TKConditionsSets<'case'>;
    expectedPermittedCaseCreationTimes: Date[];
  };

  const testCases: TestCase[] = [
    {
      description:
        'Any time based condition should be ignored if there is also an everyone condition set.',
      permissions: [['everyone'], [{ createdHoursAgo: 1 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes,
    },
    {
      description:
        'Any time based condition should be ignored if there is also an all excluding condition in the set.',
      permissions: [[{ createdDaysAgo: 10 }, 'isSupervisor']],
      expectedPermittedCaseCreationTimes: [],
    },
    {
      description:
        'Should exclude all cases with a createdAt date older than the number of hours prior to the current time if only a createdHoursAgo condition is set',
      permissions: [[{ createdHoursAgo: 8 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(cct =>
        isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 8)),
      ),
    },
    {
      description:
        'Should exclude all cases with a createdAt date older than the number of days prior to the current time if only a createdHoursAgo condition is set',
      permissions: [['everyone', { createdDaysAgo: 1 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(cct =>
        isAfter(cct, subDays(BASELINE_DATE_FOR_VALIDATION, 1)),
      ),
    },
    {
      description:
        'should use createdDaysAgo if both time based conditions are set but createdDaysAgo is the shorter duration',
      permissions: [[{ createdDaysAgo: 1, createdHoursAgo: 60 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(cct =>
        isAfter(cct, subDays(BASELINE_DATE_FOR_VALIDATION, 1)),
      ),
    },
    {
      description:
        'should use createdHoursAgo if both time based conditions are set but createdHoursAgo is the shorter duration',
      permissions: [['everyone', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(cct =>
        isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)),
      ),
    },
    {
      description: 'Should combine with other conditions in the same set',
      permissions: [['isCaseOpen', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(
        (cct, idx) =>
          isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)) && idx % 2 === 1,
      ),
    },
    {
      description: 'Should combine with other conditions in other sets',
      permissions: [['isCaseOpen'], [{ createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedCaseCreationTimes: caseCreatedTimes.filter(
        (cct, idx) =>
          isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)) || idx % 2 === 1,
      ),
    },
  ];

  describe('/cases/:id route - GET', () => {
    each(testCases).test(
      '$description',
      async ({ permissions, expectedPermittedCaseCreationTimes }: TestCase) => {
        const subRoute = id => `${route}/${id}`;
        setRules({ viewCase: permissions });
        const responses = await Promise.all(
          sampleCases.map(async c => request.get(subRoute(c.id)).set(headers)),
        );
        const permitted = responses
          .filter(({ status }) => {
            if (status === 200) return true;
            expect(status).toBe(404);
            return false;
          })
          .map(r => r.body);
        expect(permitted.map(p => p.createdAt).sort()).toEqual(
          expectedPermittedCaseCreationTimes.map(cct => cct.toISOString()).sort(),
        );
      },
    );
  });
  describe('cases/search route - POST', () => {
    each(testCases).test(
      '$description',
      async ({ permissions, expectedPermittedCaseCreationTimes }: TestCase) => {
        setRules({ viewCase: permissions });
        const expectedIds = expectedPermittedCaseCreationTimes
          .map(cct => cct.toISOString())
          .sort();
        const {
          body: { cases, count },
          status,
        } = await request.post(`${route}/search`).set(headers);
        expect(status).toBe(200);
        expect(cases.map(c => c.createdAt).sort()).toEqual(expectedIds);
        expect(count).toBe(expectedPermittedCaseCreationTimes.length);
      },
    );
  });
});
