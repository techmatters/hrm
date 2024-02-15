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

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService, createCase } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';

import * as mocks from '../mocks';
import { ruleFileWithOnePermittedOrDeniedAction } from '../permissions-overrides';
import { headers, getRequest, getServer, setRules, useOpenRules } from '../server';
import { ALWAYS_CAN, CaseSectionInsert, populateCaseSections } from '../mocks';
import { TKConditionsSets } from '@tech-matters/hrm-core/permissions/rulesMap';
import {
  connectContactToCase,
  createContact,
} from '@tech-matters/hrm-core/contact/contactService';
import { db } from '@tech-matters/hrm-core/connection-pool';
import { randomUUID } from 'crypto';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, accountSid, workerSid } = mocks;
const otherWorkerSid = 'WK-wa-wa-west';

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

const route = `/v0/accounts/${accountSid}/cases`;
describe('/cases/:id route - PUT', () => {
  const sectionsMap: Record<string, CaseSectionInsert[]> = {
    note: [
      {
        section: {
          sectionId: '1',
          sectionTypeSpecificData: {
            note: 'Child with covid-19',
          },
        },
        workerSid: 'note-adder',
      },
      {
        section: {
          sectionId: '2',
          sectionTypeSpecificData: {
            note: 'Child recovered from covid-19',
          },
        },
        workerSid: 'other-note-adder',
      },
    ],
    perpetrator: [
      {
        section: {
          sectionTypeSpecificData: {
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
        workerSid: 'perpetrator-adder',
      },
      {
        section: {
          sectionTypeSpecificData: {
            firstName: 'J.',
            lastName: 'Doe',
            phone2: '+12345678',
          },
        },
        workerSid: 'perpetrator-adder',
      },
    ],

    household: [
      {
        section: {
          sectionTypeSpecificData: {
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
        workerSid: 'household-adder',
      },
      {
        section: {
          sectionTypeSpecificData: {
            firstName: 'J.',
            lastName: 'Doe',
            phone2: '+12345678',
          },
        },
        workerSid: 'household-adder',
      },
    ],

    incident: [
      {
        section: {
          sectionTypeSpecificData: {
            date: '2021-03-03',
            duration: '',
            location: 'Other',
            isCaregiverAware: null,
            incidentWitnessed: null,
            reactionOfCaregiver: '',
            whereElseBeenReported: '',
            abuseReportedElsewhere: null,
          },
        },
        workerSid: 'incident-adder',
      },
    ],

    referral: [
      {
        section: {
          sectionId: '2503',
          sectionTypeSpecificData: {
            date: '2021-02-18',
            comments: 'Referred to state agency',
            referredTo: 'DREAMS',
          },
        },
        workerSid: 'referral-adder',
      },
    ],

    document: [
      {
        section: {
          sectionId: '5e127299-17ba-4adf-a040-69dac9ca45bf',
          sectionTypeSpecificData: {
            comments: 'test file!',
            fileName: 'sample1.pdf',
          },
        },
        workerSid: 'document-adder',
      },
      {
        section: {
          sectionId: '10d21f35-142c-4538-92db-d558f80898ae',
          sectionTypeSpecificData: {
            comments: '',
            fileName: 'sample2.pdf',
          },
        },
        workerSid: 'document-adder',
      },
    ],
  };

  const cases: Record<string, CaseService> = {};
  let subRoute;

  beforeEach(async () => {
    cases.blank = await caseApi.createCase({ ...case1, info: {} }, accountSid, workerSid);
    cases.populated = await caseApi.createCase(
      {
        ...case1,
        info: {
          summary: 'something summery',
        },
      },
      accountSid,
      workerSid,
    );
    subRoute = id => `${route}/${id}`;

    cases.populated = await populateCaseSections(
      cases.populated.id.toString(),
      sectionsMap,
      accountSid,
    );
  });

  afterEach(async () => {
    await Promise.all(
      [cases.blank, cases.populated].map(c => {
        if (c) {
          return caseDb.deleteById(c.id, accountSid);
        }
        console.warn(`No case to delete when cleaning up`);
        return Promise.resolve();
      }),
    );
  });

  describe('Case record updates', () => {
    type TestCase = (
      | { caseUpdate: Partial<CaseService> }
      | {
          infoUpdate:
            | ((oi: CaseService['info']) => CaseService['info'])
            | Partial<CaseService['info']>;
        }
    ) & {
      changeDescription: string;
      actionToTest: string;
      casesToTest: ('blank' | 'populated')[];
    };

    const testCases: TestCase[] = [
      {
        caseUpdate: { status: 'closed' },
        changeDescription: 'status changed',
        actionToTest: 'closeCase',
        casesToTest: ['blank', 'populated'],
      },
      {
        infoUpdate: { summary: 'To summarize....' },
        changeDescription: 'summary changed',
        actionToTest: 'editCaseOverview',
        casesToTest: ['blank', 'populated'],
      },
      {
        infoUpdate: oi => ({
          ...oi,
          counsellorNotes: [
            ...(oi.counsellorNotes ?? []),
            {
              id: '3',
              note: 'Added',
              twilioWorkerId: 'note-adder',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
        changeDescription: 'note added',
        actionToTest: 'addNote',
        casesToTest: ['blank', 'populated'],
      },
      {
        infoUpdate: oi => ({
          ...oi,
          households: [
            ...(oi.households ?? []),
            {
              household: {
                firstName: 'Jane',
                lastName: 'Doe',
              },
              createdAt: new Date().toISOString(),
              twilioWorkerId: 'household-adder',
            },
          ],
        }),
        changeDescription: 'household added',
        actionToTest: 'addHousehold',
        casesToTest: ['blank', 'populated'],
      },
      {
        infoUpdate: oi => ({
          ...oi,
          perpetrators: oi.perpetrators.map((p, idx) =>
            idx === 0
              ? {
                  perpetrator: {
                    firstName: 'Jane',
                    lastName: 'Doe',
                  },
                  createdAt: '2022-03-15T20:56:22.640Z',
                  twilioWorkerId: 'perp-editor',
                }
              : p,
          ),
        }),
        changeDescription: 'perpetrator edited',
        actionToTest: 'editPerpetrator',
        casesToTest: ['populated'],
      },
      {
        infoUpdate: oi => ({
          ...oi,
          documents: oi.documents.map((p, idx) =>
            idx === 0
              ? {
                  id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
                  documents: {
                    comments: 'can I edit the test file?',
                    fileName: 'something_other_than_sample1.pdf',
                  },
                  createdAt: '2022-03-15T20:56:22.640Z',
                  twilioWorkerId: 'perp-editor',
                }
              : p,
          ),
        }),
        changeDescription: 'documents edited',
        actionToTest: 'editDocument',
        casesToTest: ['populated'],
      },
      {
        infoUpdate: oi => ({
          ...oi,
          households: [
            oi.households[1],
            {
              household: {
                firstName: 'Jane',
                lastName: 'Doe',
              },
              createdAt: new Date().toISOString(),
              twilioWorkerId: 'household-adder',
            },
            oi.households[0],
          ],
        }),
        changeDescription: 'household added and order changed',
        actionToTest: 'addHousehold',
        casesToTest: ['populated'],
      },
    ];

    each(
      testCases.flatMap(tc =>
        tc.casesToTest.flatMap(oc => [
          {
            ...tc,
            testingDeniedCase: false,
            changeDescription: `${oc} case: should return 200 when ${tc.changeDescription} (${tc.actionToTest} is permitted)`,
            originalCase: () => cases[oc],
          },
          {
            ...tc,
            testingDeniedCase: true,
            changeDescription: `${oc} should return 401 when ${tc.changeDescription} (${tc.actionToTest} is prohibited)`,
            originalCase: () => cases[oc],
          },
        ]),
      ),
      //.filter((tc) => tc.changeDescription.includes('populated case: should return 200 when documents edited (editDocument is permitted)')),
    ).test(
      '$changeDescription',
      async ({
        caseUpdate: caseUpdateParam = {},
        infoUpdate: infoUpdateParam = undefined,
        originalCase: originalCaseGetter = () => cases.blank,
        actionToTest,
        testingDeniedCase,
      }) => {
        const caseUpdate =
          typeof caseUpdateParam === 'function' ? caseUpdateParam() : caseUpdateParam;
        const originalCase = originalCaseGetter();
        const update = {
          ...caseUpdate,
        };
        const infoUpdate =
          typeof infoUpdateParam === 'function'
            ? infoUpdateParam(originalCase.info)
            : infoUpdateParam;
        if (infoUpdate) {
          update.info = { ...originalCase.info, ...caseUpdate.info, ...infoUpdate };
        }

        setRules(
          ruleFileWithOnePermittedOrDeniedAction(actionToTest, !testingDeniedCase),
        );
        const permittedResponse = await request
          .put(subRoute(originalCase.id))
          .set(headers)
          .send(update);

        expect(permittedResponse.status).toBe(testingDeniedCase ? 401 : 200);
        useOpenRules();
      },
    );
  });
});

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
    for (const user of [workerSid, otherWorkerSid]) {
      const newCases = await Promise.all(
        caseDescriptions[user].map(desc =>
          createCase({ info: { summary: desc } }, accountSid, user),
        ),
      );
      const [, caseWithOtherContact, caseWithOwnedContact] = newCases;
      const [ownedContact, otherContact] = await Promise.all(
        [workerSid, otherWorkerSid].map(contactUser =>
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
          ),
        ),
      );
      await Promise.all([
        connectContactToCase(
          accountSid,
          user,
          ownedContact.id.toString(),
          caseWithOwnedContact.id.toString(),
          ALWAYS_CAN,
        ),
        connectContactToCase(
          accountSid,
          user,
          otherContact.id.toString(),
          caseWithOtherContact.id.toString(),
          ALWAYS_CAN,
        ),
      ]);
      sampleCases.push(...newCases);
    }
  });

  afterEach(async () => {
    await db.task(async t => {
      await t.none('DELETE FROM "Contacts"');
      await t.none('DELETE FROM "Cases"');
    });
  });

  test('stub', () => {});

  type TestCase = {
    permissions: TKConditionsSets<'case'>;
    expectedPermittedCases: string[];
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
  ];

  describe('/cases/:id route - GET', () => {
    const testCasesWithDescriptions = testCases.map(tc => ({
      ...tc,
      description: `cases ${tc.expectedPermittedCases
        .map(desc => `[${desc}]`)
        .join(', ')} should be permitted when VIEW_CASE permissions are ${JSON.stringify(
        tc.permissions,
      )}`,
    }));
    each(testCasesWithDescriptions).test(
      '$description',
      async ({ permissions, expectedPermittedCases }: TestCase) => {
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
      )}`,
    }));
    each(testCasesWithDescriptions).test(
      '$description',
      async ({ permissions, expectedPermittedCases }: TestCase) => {
        setRules({ viewCase: permissions });
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
