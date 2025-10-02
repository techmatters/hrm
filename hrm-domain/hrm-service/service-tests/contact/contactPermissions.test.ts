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

import formatISO from 'date-fns/formatISO';
import subMinutes from 'date-fns/subMinutes';
import { randomBytes } from 'crypto';

import { TKConditionsSets, RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import { headers, setRules, useOpenRules } from '../server';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import * as contactService from '@tech-matters/hrm-core/contact/contactService';
import { TargetKind } from '@tech-matters/hrm-core/permissions/actions';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { AccountSID, WorkerSID } from '@tech-matters/types';
import { ALWAYS_CAN } from '../mocks';
import { clearAllTables } from '../dbCleanup';
import each from 'jest-each';
import { addMinutes, isAfter, parseISO, subDays, subHours } from 'date-fns';
import { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { setupServiceTests } from '../setupServiceTest';

const accountSid: AccountSID = `AC${randomBytes(16).toString('hex')}`;
const userTwilioWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
const anotherUserTwilioWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
const rawJson: ContactRawJson = {
  callType: 'Silent',
  categories: {},
  caseInformation: {
    actionTaken: '',
    callSummary: '',
    okForCaseWorkerToCall: null,
    hasConversationEvolved: 'Não',
    didYouDiscussRightsWithTheChild: null,
    didTheChildFeelWeSolvedTheirProblem: null,
  },
  contactlessTask: {
    date: '',
    time: '',
    channel: '',
    helpline: 'SaferNet',
    createdOnBehalfOf: userTwilioWorkerId,
  },
  childInformation: {
    age: '',
    city: '',
    lastName: '',
    firstName: '',
    email: '',
    state: '',
    gender: '',
    phone1: '',
    phone2: '',
    ethnicity: '',
  },
  callerInformation: {
    age: '',
    city: '',
    lastName: '',
    firstName: '',
    email: '',
    state: '',
    gender: '',
    phone1: '',
    phone2: '',
    relationshipToChild: '',
  },
  definitionVersion: 'br-v1',
};

const createContact = async (
  twilioWorkerId: WorkerSID,
  created?: Date,
): Promise<contactDb.Contact> => {
  const timeOfContact = formatISO(created ?? subMinutes(new Date(), 5));
  const taskSid = `WT${randomBytes(16).toString('hex')}`;
  const channelSid = `CH${randomBytes(16).toString('hex')}`;
  return contactService.createContact(
    accountSid,
    twilioWorkerId,
    {
      rawJson,
      twilioWorkerId,
      timeOfContact,
      taskId: taskSid,
      channelSid,
      queueName: 'Admin',
      helpline: 'helpline',
      conversationDuration: 5,
      serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      definitionVersion: 'as-v1',
    },
    ALWAYS_CAN,
    true,
  );
};

const overridePermissions = <T extends TargetKind>(
  key: keyof RulesFile,
  permissions: TKConditionsSets<T>,
) => {
  useOpenRules();
  const rules: Partial<RulesFile> = {
    [key]: permissions,
  };
  setRules(rules);
};

const overrideViewContactPermissions = (permissions: TKConditionsSets<'contact'>) =>
  overridePermissions('viewContact', permissions);

const { request } = setupServiceTests(userTwilioWorkerId);

describe('isOwner', () => {
  type TestCase = {
    description: string;
    viewContactPermissions: TKConditionsSets<'contact'>;
    expectedContactsByOwner: (
      | typeof userTwilioWorkerId
      | typeof anotherUserTwilioWorkerId
    )[];
  };

  const testCases: TestCase[] = [
    {
      description:
        'return only contacts created by the owner when it has isOwner permission',
      viewContactPermissions: [['isOwner']],
      expectedContactsByOwner: [userTwilioWorkerId],
    },
    {
      description:
        'returns everything if isOwner condition set is alongside an everyone set',
      viewContactPermissions: [['isOwner'], ['everyone']],
      expectedContactsByOwner: [userTwilioWorkerId, anotherUserTwilioWorkerId],
    },
  ];

  let usersContact: contactService.Contact;
  let anotherUsersContact: contactService.Contact;

  beforeEach(async () => {
    usersContact = await createContact(userTwilioWorkerId);
    anotherUsersContact = await createContact(anotherUserTwilioWorkerId);
  });

  describe('GET /contacts/:id', () => {
    const routeBase = `/v0/accounts/${accountSid}/contacts`;
    each(testCases).test(
      '$description',
      async ({ viewContactPermissions, expectedContactsByOwner }: TestCase) => {
        overrideViewContactPermissions(viewContactPermissions);

        const responses = await Promise.all(
          [usersContact, anotherUsersContact].map(contact =>
            request.get(`${routeBase}/${contact.id}`).set(headers),
          ),
        );
        const retrievedContacts = responses
          .filter(({ status }) => {
            if (status == 200) {
              return true;
            } else {
              expect(status).toBe(404);
              return false;
            }
          })
          .map(({ body }) => body);
        expect(
          retrievedContacts
            .map((contact: contactDb.Contact) => contact.twilioWorkerId)
            .sort(),
        ).toStrictEqual(expectedContactsByOwner.sort());
      },
    );
  });
});

describe('Time based condition', () => {
  let sampleContacts: Record<string, Contact>;
  // Not great to be using the current time from a determinism standpoint.
  // Unfortunately, faking out the date & time with Jest borks the DB client when interacting with a DB container still using the correct time
  // The alternative is to add lots of 'for testing' injection points for dates, but this seems like it could be abused or broken easily
  // This way we only need to add one injection point for the current time, and that's on an internal function that's not exposed to the outside world.
  const BASELINE_DATE = new Date();
  const contactCreatedTimes = [
    subDays(BASELINE_DATE, 3),
    subDays(BASELINE_DATE, 2),
    subDays(BASELINE_DATE, 1),
    subHours(BASELINE_DATE, 12),
    subHours(BASELINE_DATE, 9),
    subHours(BASELINE_DATE, 6),
  ];

  const BASELINE_DATE_FOR_VALIDATION = addMinutes(BASELINE_DATE, 10);

  beforeEach(async () => {
    useOpenRules();
    sampleContacts = {};
    for (const [idx, createdAt] of Object.entries(contactCreatedTimes)) {
      sampleContacts[createdAt.toISOString()] = await createContact(
        parseInt(idx) % 2 === 0 ? userTwilioWorkerId : anotherUserTwilioWorkerId,
        createdAt,
      );
    }
  });

  afterEach(async () => {
    await clearAllTables();
  });

  type TestCase = {
    description: string;
    permissions: TKConditionsSets<'contact'>;
    expectedPermittedContactCreationTimes: Date[];
  };

  const testCases: TestCase[] = [
    {
      description:
        'Any time based condition should be ignored if there is also an everyone condition set.',
      permissions: [['everyone'], [{ createdHoursAgo: 1 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes,
    },
    {
      description:
        'Any time based condition should be ignored if there is also an all excluding condition in the set.',
      permissions: [[{ createdDaysAgo: 10 }, 'isSupervisor']],
      expectedPermittedContactCreationTimes: [],
    },
    {
      description:
        'Should exclude all cases with a createdAt date older than the number of hours prior to the current time if only a createdHoursAgo condition is set',
      permissions: [[{ createdHoursAgo: 8 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct =>
        isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 8)),
      ),
    },
    {
      description:
        'Should exclude all cases with a createdAt date older than the number of days prior to the current time if only a createdHoursAgo condition is set',
      permissions: [['everyone', { createdDaysAgo: 1 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct =>
        isAfter(cct, subDays(BASELINE_DATE_FOR_VALIDATION, 1)),
      ),
    },
    {
      description:
        'should use createdDaysAgo if both time based conditions are set but createdDaysAgo is the shorter duration',
      permissions: [[{ createdDaysAgo: 1, createdHoursAgo: 60 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct =>
        isAfter(cct, subDays(BASELINE_DATE_FOR_VALIDATION, 1)),
      ),
    },
    {
      description:
        'should use createdHoursAgo if both time based conditions are set but createdHoursAgo is the shorter duration',
      permissions: [['everyone', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct =>
        isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)),
      ),
    },
    {
      description: 'Should combine with other conditions in the same set',
      permissions: [['isOwner', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(
        (cct, idx) =>
          isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)) && idx % 2 === 0,
      ),
    },
    {
      description: 'Should combine with other conditions in other sets',
      permissions: [['isOwner'], [{ createdDaysAgo: 2, createdHoursAgo: 7 }]],
      expectedPermittedContactCreationTimes: contactCreatedTimes.filter(
        (cct, idx) =>
          isAfter(cct, subHours(BASELINE_DATE_FOR_VALIDATION, 7)) || idx % 2 === 0,
      ),
    },
  ];

  const route = `/v0/accounts/${accountSid}/contacts`;
  describe('/contact/:id route - GET', () => {
    each(testCases).test(
      '$description',
      async ({ permissions, expectedPermittedContactCreationTimes }: TestCase) => {
        const subRoute = id => `${route}/${id}`;
        setRules({ viewContact: permissions });
        const responses = await Promise.all(
          Object.values(sampleContacts).map(async c =>
            request.get(subRoute(c.id)).set(headers),
          ),
        );
        const permitted = responses
          .filter(({ status }) => {
            if (status === 200) return true;
            expect(status).toBe(404);
            return false;
          })
          .map(r => r.body as Contact);
        expect(
          permitted
            .map(p => parseISO(p.timeOfContact))
            .sort((a, b) => a.valueOf() - b.valueOf()),
        ).toEqual(
          expectedPermittedContactCreationTimes.map(cct =>
            parseISO(sampleContacts[cct.toISOString()].timeOfContact),
          ),
        );
      },
    );
  });
});
