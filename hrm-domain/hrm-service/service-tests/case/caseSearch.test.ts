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
import { add, addDays } from 'date-fns';
import each from 'jest-each';

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService, getCase } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import {
  CaseListFilters,
  DateExistsCondition,
} from '@tech-matters/hrm-core/case/caseDataAccess';
import { db } from '@tech-matters/hrm-core/connection-pool';
import {
  fillNameAndPhone,
  validateCaseListResponse,
  validateSingleCaseResponse,
} from './caseValidation';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as mocks from '../mocks';
import { ruleFileActionOverride } from '../permissions-overrides';
import {
  addConversationMediaToContact,
  connectContactToCase,
  createContact,
} from '@tech-matters/hrm-core/contact/contactService';
import { getRequest, getServer, headers, setRules, useOpenRules } from '../server';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { isS3StoredTranscript } from '@tech-matters/hrm-core/conversation-media/conversation-media';
import { ALWAYS_CAN, CaseSectionInsert, populateCaseSections } from '../mocks';
import { AccountSID } from '@tech-matters/types';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, contact1, accountSid, workerSid } = mocks;

type InsertSampleCaseSettings = {
  sampleSize: number;
  accounts: readonly AccountSID[];
  helplines: string[];
  workers?: string[];
  statuses?: string[];
  cases?: { case: Partial<CaseService>; sections: Record<string, CaseSectionInsert[]> }[];
  contactNames?: { firstName: string; lastName: string }[];
  contactNumbers?: string[];
  createdAtGenerator?: (idx: number) => string;
  updatedAtGenerator?: (idx: number) => string;
  followUpDateGenerator?: (idx: number) => string;
  categoriesGenerator?: (idx: number) => Record<string, string[]>;
};

export type CaseWithContact = {
  case: CaseService;
  contact: Contact;
};
const insertSampleCases = async ({
  sampleSize,
  accounts,
  helplines,
  workers = [workerSid],
  statuses = ['open'],
  cases = [{ case: case1, sections: {} }],
  contactNames = [{ firstName: 'Maria', lastName: 'Silva' }],
  contactNumbers = ['+1-202-555-0184'],
  createdAtGenerator = () => undefined,
  updatedAtGenerator = () => undefined,
  followUpDateGenerator = () => undefined,
  categoriesGenerator = () => undefined,
}: InsertSampleCaseSettings): Promise<CaseWithContact[]> => {
  const createdCasesAndContacts: CaseWithContact[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    const toCreate: Partial<CaseService> = {
      ...cases[i % cases.length]?.case,
      helpline: helplines[i % helplines.length],
      status: statuses[i % statuses.length],
      twilioWorkerId: workers[i % workers.length],
    };
    const createdAt = createdAtGenerator(i);
    if (createdAt) {
      toCreate.createdAt = createdAt;
    } else {
      delete toCreate.createdAt;
    }
    const updatedAt = updatedAtGenerator(i);
    if (updatedAt) {
      toCreate.updatedAt = updatedAt;
    } else {
      delete toCreate.updatedAt;
    }
    const followUpDate = followUpDateGenerator(i);
    if (typeof followUpDate !== 'undefined') {
      toCreate.info = toCreate.info ?? {};
      toCreate.info.followUpDate = followUpDate;
    } else if (toCreate.info) {
      delete toCreate.info.followUpDate;
    }
    let createdCase = await caseApi.createCase(
      toCreate,
      accounts[i % accounts.length],
      workers[i % workers.length],
    );
    let connectedContact: contactDb.Contact;
    if (contactNames[i % contactNames.length]) {
      const contactToCreate = fillNameAndPhone(
        {
          ...contact1,
          twilioWorkerId: workers[i % workers.length],
          helpline: helplines[i % helplines.length],
        },
        contactNames[i % contactNames.length],
        contactNumbers[i % contactNumbers.length],
      );
      contactToCreate.timeOfContact = new Date().toISOString();
      contactToCreate.taskId = undefined;
      contactToCreate.channelSid = `CHANNEL_${i}`;
      contactToCreate.serviceSid = 'SERVICE_SID';

      const categories = categoriesGenerator(i);
      if (categories) {
        contactToCreate.rawJson = contactToCreate.rawJson ?? {
          caseInformation: {},
          categories: {},
          callerInformation: {},
          childInformation: {},
          callType: '',
        };
        contactToCreate.rawJson.categories = categories;
      } else if (contactToCreate.rawJson) {
        delete contactToCreate.rawJson.categories;
      }
      const { contact: savedContact } = await contactDb.create()(
        accounts[i % accounts.length],
        contactToCreate,
      );
      connectedContact = await contactDb.connectToCase()(
        savedContact.accountSid,
        savedContact.id.toString(),
        createdCase.id.toString(),
        workerSid,
      );
    }
    createdCase = await populateCaseSections(
      createdCase.id.toString(),
      cases[i % cases.length]?.sections ?? {},
      accounts[i % accounts.length],
    );
    createdCasesAndContacts.push({
      contact: connectedContact,
      case: createdCase,
    });
  }
  return createdCasesAndContacts;
};

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterEach(async () => {
  await db.none(`DELETE FROM "ConversationMedias"`);
  await db.none(`DELETE FROM "Contacts"`);
  await db.none(`DELETE FROM "CaseSections"`);
  await db.none(`DELETE FROM "Cases"`);
  useOpenRules();
});

describe('/cases route', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 200', async () => {
      const response = await request.get(route).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({ cases: [], count: 0 });
    });
    describe('With single record', () => {
      let createdCase;
      let createdContact: contactDb.Contact;

      beforeEach(async () => {
        createdCase = await caseApi.createCase(case1, accountSid, workerSid);
        const contactToCreate = fillNameAndPhone({
          ...contact1,
          twilioWorkerId: workerSid,
          timeOfContact: new Date().toISOString(),
          taskId: `TASK_SID`,
          channelSid: `CHANNEL_SID`,
          serviceSid: 'SERVICE_SID',
          profileId: undefined,
          identifierId: undefined,
        });

        contactToCreate.timeOfContact = new Date().toISOString();
        contactToCreate.taskId = `TASK_SID`;
        contactToCreate.channelSid = `CHANNEL_SID`;
        contactToCreate.serviceSid = 'SERVICE_SID';
        createdContact = (await contactDb.create()(accountSid, contactToCreate)).contact;
        createdContact = await contactDb.connectToCase()(
          accountSid,
          createdContact.id.toString(),
          createdCase.id,
          workerSid,
        );
        createdCase = await getCase(createdCase.id, accountSid, ALWAYS_CAN); // refresh case from DB now it has a contact connected
      });

      // eslint-disable-next-line jest/expect-expect
      test('should return 200 when populated', async () => {
        const response = await request.get(route).set(headers);

        validateSingleCaseResponse(response, createdCase, createdContact);
      });
    });
    describe('With multiple records', () => {
      const CASE_SAMPLE_SIZE = 10;
      const createdCasesAndContacts: CaseWithContact[] = [];
      const accounts = ['ACCOUNT_SID_1', 'ACCOUNT_SID_2'] as const;
      const helplines = ['helpline-1', 'helpline-2', 'helpline-3'];
      beforeEach(async () => {
        createdCasesAndContacts.length = 0;
        createdCasesAndContacts.push(
          ...(await insertSampleCases({
            sampleSize: CASE_SAMPLE_SIZE,
            helplines,
            accounts,
          })),
        );
      });

      type TestCase = {
        description: string;
        listRoute: string;
        expectedCasesAndContacts: () => CaseWithContact[];
        expectedTotalCount: number;
      };

      const testCases: TestCase[] = [
        {
          description:
            'should return all cases for account when no helpline, limit or offset is specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(ccc => ccc.case.accountSid === accounts[0])
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
          expectedTotalCount: 5,
        },
        {
          description:
            'should return all cases for account & helpline when helpline is specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases?helpline=${helplines[1]}`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(
                ccc =>
                  ccc.case.accountSid === accounts[0] &&
                  ccc.case.helpline === helplines[1],
              )
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
          expectedTotalCount: 1,
        },
        {
          description: 'should return first X cases when limit X is specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases?limit=3`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(ccc => ccc.case.accountSid === accounts[0])
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
              .slice(0, 3),
          expectedTotalCount: 5,
        },
        {
          description:
            'should return X cases, starting at Y when limit X and offset Y are specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases?limit=2&offset=1`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(ccc => ccc.case.accountSid === accounts[0])
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
              .slice(1, 3),
          expectedTotalCount: 5,
        },
        {
          description:
            'should return remaining cases, starting at Y when offset Y and no limit is specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases?offset=2`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(ccc => ccc.case.accountSid === accounts[0])
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
              .slice(2),
          expectedTotalCount: 5,
        },
        {
          description:
            'should apply offset and limit to filtered set when helpline filter is applied',
          listRoute: `/v0/accounts/${accounts[0]}/cases?helpline=${helplines[0]}&limit=1&offset=1`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(
                ccc =>
                  ccc.case.accountSid === accounts[0] &&
                  ccc.case.helpline === helplines[0],
              )
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
              .slice(1, 2),
          expectedTotalCount: 2,
        },
      ];

      // eslint-disable-next-line jest/expect-expect
      each(testCases).test(
        '$description',
        async ({ listRoute, expectedCasesAndContacts, expectedTotalCount }: TestCase) => {
          const response = await request.get(listRoute).set(headers);
          validateCaseListResponse(
            response,
            expectedCasesAndContacts(),
            expectedTotalCount,
          );
        },
      );
    });

    each([
      {
        expectTranscripts: true,
        description: `with viewExternalTranscript includes transcripts`,
      },
      {
        expectTranscripts: false,
        description: `without viewExternalTranscript excludes transcripts`,
      },
    ]).test(`with connectedContacts $description`, async ({ expectTranscripts }) => {
      const createdCase = await caseApi.createCase(case1, accountSid, workerSid);
      let createdContact = await createContact(
        accountSid,
        workerSid,
        mocks.withTaskId,
        ALWAYS_CAN,
      );
      createdContact = await addConversationMediaToContact(
        accountSid,
        createdContact.id.toString(),
        mocks.conversationMedia,
        ALWAYS_CAN,
      );
      await connectContactToCase(
        accountSid,
        workerSid,
        String(createdContact.id),
        String(createdCase.id),
        {
          user: twilioUser(workerSid, []),
          can: () => true,
        },
      );

      useOpenRules();
      if (!expectTranscripts) {
        setRules(ruleFileActionOverride('viewExternalTranscript', false));
      }
      const response = await request
        .get(route)
        .query({
          dateFrom: createdCase.createdAt,
          dateTo: createdCase.createdAt,
          firstName: 'withTaskId',
        })
        .set(headers);

      expect(response.status).toBe(200);

      expect(<caseApi.CaseService>response.body.cases).toHaveLength(1);

      if (expectTranscripts) {
        expect(
          (<caseApi.CaseService[]>response.body.cases).every(
            caseObj =>
              caseObj.connectedContacts?.every(
                c => c.conversationMedia?.some(isS3StoredTranscript),
              ),
          ),
        ).toBeTruthy();
      } else {
        expect(
          (<caseApi.CaseService[]>response.body.cases).every(
            caseObj =>
              caseObj.connectedContacts?.every(
                c => c.conversationMedia?.some(isS3StoredTranscript),
              ),
          ),
        ).toBeFalsy();
      }
    });
  });

  const households = {
    household: [
      {
        workerSid,
        section: {
          sectionTypeSpecificData: {
            firstName: 'Maria',
            lastName: 'Silva',
            phone1: '+1-202-555-0184',
          },
        },
      },
      {
        workerSid,
        section: {
          sectionTypeSpecificData: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      },
    ],
  };

  const perpetrators: Record<string, CaseSectionInsert[]> = {
    perpetrator: [
      {
        workerSid,
        section: {
          sectionTypeSpecificData: {
            firstName: 'Maria',
            lastName: 'Silva',
          },
        },
      },
      {
        workerSid,
        section: {
          sectionTypeSpecificData: {
            firstName: 'John',
            lastName: 'Doe',
            phone2: '+12025550184',
          },
        },
      },
    ],
  };

  describe('/cases/search route', () => {
    describe('POST', () => {
      describe('3 sample records', () => {
        let createdCase1;
        let createdCase2;
        let createdCase3;
        let createdContact: contactDb.Contact;
        const subRoute = `${route}/search`;
        const searchTestRunStart = new Date().toISOString();

        beforeEach(async () => {
          createdCase1 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase1 = await populateCaseSections(
            createdCase1.id,
            households,
            accountSid,
          );
          createdCase2 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase3 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase3 = await populateCaseSections(
            createdCase3.id,
            perpetrators,
            accountSid,
          );
          const toCreate = fillNameAndPhone({ ...contact1, twilioWorkerId: workerSid });

          toCreate.timeOfContact = new Date().toISOString();
          toCreate.taskId = `TASK_SID`;
          toCreate.channelSid = `CHANNEL_SID`;
          toCreate.serviceSid = 'SERVICE_SID';
          // Connects createdContact with createdCase2
          createdContact = (await contactDb.create()(accountSid, toCreate)).contact;
          createdContact = await contactDb.connectToCase()(
            accountSid,
            createdContact.id.toString(),
            createdCase2.id,
            workerSid,
          );
          // Get case 2 again, now a contact is connected
          createdCase2 = await caseApi.getCase(createdCase2.id, accountSid, ALWAYS_CAN);
        });

        afterEach(async () => {
          await db.none(`DELETE FROM "Contacts" WHERE id = $<id>`, {
            id: createdContact.id,
          });
          await caseDb.deleteById(createdCase1.id, accountSid);
          await caseDb.deleteById(createdCase2.id, accountSid);
          await caseDb.deleteById(createdCase3.id, accountSid);
        });

        test('should return 401', async () => {
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .send({});

          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Authorization failed');
        });

        each([
          {
            description:
              'When first name and last name specified, should return records that match',
            body: {
              helpline: 'helpline',
              firstName: 'maria',
              lastName: 'silva',
            },
          },
          {
            description: 'When phone number specified, should return records that match',
            body: {
              helpline: 'helpline',
              phoneNumber: '2025550184',
            },
          },
          {
            description: 'When date range specified, should return records that match',
            body: {
              helpline: 'helpline',
              dateFrom: searchTestRunStart,
              dateTo: new Date().toISOString(),
            },
          },
        ]).test('$description', async ({ body }) => {
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);

          expect(response.status).toBe(200);
          const ids = response.body.cases.map(c => c.id);
          expect(ids).toContain(createdCase1.id);
          expect(ids).toContain(createdCase2.id);
          expect(ids).toContain(createdCase3.id);
          expect(response.body.count).toBe(3);
        });

        test('should return 200 - search by contact number', async () => {
          const body = {
            helpline: 'helpline',
            contactNumber: '+1-202-555-0184',
          };
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);
          validateSingleCaseResponse(response, createdCase2, createdContact);
        });

        // eslint-disable-next-line jest/expect-expect
        test('should only return case with contact when closedCase flag set false', async () => {
          const body = {
            closedCases: false,
          };
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);
          validateSingleCaseResponse(response, createdCase2, createdContact);
        });

        // eslint-disable-next-line jest/expect-expect
        test('should not return closed case with contact when closedCase flag set false', async () => {
          const body = {
            closedCases: false,
          };
          await caseApi.updateCase(
            createdCase2.id,
            { status: 'closed' },
            accountSid,
            ALWAYS_CAN,
          );
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);
          expect(response.body.cases.length).toBe(0);
          expect(response.body.count).toBe(0);
        });
      });

      describe('Larger record set', () => {
        const baselineDate = new Date(2010, 6, 15);
        const accounts = ['ACCOUNT_SID_1', 'ACCOUNT_SID_2'] as const;
        const helplines = ['helpline-1', 'helpline-2', 'helpline-3'];
        const SIMPLE_SAMPLE_CONFIG: InsertSampleCaseSettings = {
          accounts,
          helplines,
          sampleSize: 10,
        };

        const SEARCHABLE_PHONE_NUMBER_SAMPLE_CONFIG: InsertSampleCaseSettings = {
          ...SIMPLE_SAMPLE_CONFIG,
          accounts: ['ACCOUNT_SID_1'],
          cases: [
            {
              case: case1,
              sections: {
                perpetrator: [
                  {
                    workerSid,
                    section: { sectionTypeSpecificData: { phone1: '111 222 333' } },
                  },
                ],
              },
            },
            {
              case: case1,
              sections: {
                perpetrator: [
                  {
                    workerSid,
                    section: { sectionTypeSpecificData: { phone1: '444 555 666' } },
                  },
                ],
              },
            },
            { case: case1, sections: {} },
            {
              case: case1,
              sections: {
                household: [
                  {
                    workerSid,
                    section: { sectionTypeSpecificData: { phone1: '111 222 333' } },
                  },
                ],
              },
            },
          ],
        };
        const SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG: InsertSampleCaseSettings = {
          ...SIMPLE_SAMPLE_CONFIG,
          accounts: ['ACCOUNT_SID_1'],
          contactNumbers: [undefined, '111 222 333', '444 555 666', '111 222 333'],
        };

        describe('Filter tests', () => {
          type SearchTest = {
            description: string;
            searchRoute: string;
            sampleConfig: InsertSampleCaseSettings;
            expectedCasesAndContacts: (
              sampleCasesAndContacts: CaseWithContact[],
            ) => CaseWithContact[];
            body?: any;
            expectedTotalCount: number;
          };

          const testCases: SearchTest[] = [
            {
              description:
                'should return all cases for account when no helpline, limit or offset is specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.accountSid === accounts[0])
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should return all cases for account & helpline when helpline is specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                helpline: helplines[1],
              },
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      ccc.case.accountSid === accounts[0] &&
                      ccc.case.helpline === helplines[1],
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 1,
            },
            {
              description:
                'should return all cases for account & any specified helpline when multiple helplines are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  helplines: [helplines[1], helplines[2]],
                },
              },
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      ccc.case.accountSid === accounts[0] &&
                      [helplines[1], helplines[2]].indexOf(ccc.case.helpline) !== -1,
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 3,
            },
            {
              description: 'should return first X cases when limit X is specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?limit=3`,
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.accountSid === accounts[0])
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .slice(0, 3),
              expectedTotalCount: 5,
            },
            {
              description:
                'should return X cases, starting at Y when limit X and offset Y are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?limit=2&offset=1`,
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.accountSid === accounts[0])
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .slice(1, 3),
              expectedTotalCount: 5,
            },
            {
              description:
                'should return remaining cases, starting at Y when offset Y and no limit is specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?offset=2`,
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.accountSid === accounts[0])
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .slice(2),
              expectedTotalCount: 5,
            },
            {
              description:
                'should apply offset and limit to filtered set when helpline filter is applied',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?limit=1&offset=1`,
              body: {
                helpline: helplines[0],
              },
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      ccc.case.accountSid === accounts[0] &&
                      ccc.case.helpline === helplines[0],
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .slice(1, 2),
              expectedTotalCount: 2,
            },
            {
              description: 'should order by ID ASC when this is specified in the query',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?sortBy=id&sortDirection=ASC`,
              sampleConfig: SIMPLE_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.accountSid === accounts[0])
                  .sort((ccc1, ccc2) => ccc1.case.id - ccc2.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should find phone number matches on attached households and perpetrators',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?`,
              body: {
                phoneNumber: '111 222 333',
              },
              sampleConfig: SEARCHABLE_PHONE_NUMBER_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter((ccc, idx) => idx % 4 === 0 || idx % 4 === 3)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should find other phone number on partial start matches on attached households and perpetrators',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?`,
              body: {
                phoneNumber: '444',
              },
              sampleConfig: SEARCHABLE_PHONE_NUMBER_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter((ccc, idx) => idx % 4 === 1)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 3,
            },
            {
              description: 'should find phone number matches with limit applied',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search?limit = 3`,
              body: {
                phoneNumber: '111 222 333',
              },
              sampleConfig: SEARCHABLE_PHONE_NUMBER_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter((ccc, idx) => idx % 4 === 0 || idx % 4 === 3)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .slice(0, 3),
              expectedTotalCount: 5,
            },
            {
              description:
                'should find phone number matches on attached households and perpetrators',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                phoneNumber: '111 222 333',
              },
              sampleConfig: SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter((ccc, idx) => idx % 4 === 1 || idx % 4 === 3)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description: 'should filter by specified statuses',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  statuses: ['other', 'closed'],
                },
              },
              sampleConfig: {
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                statuses: ['open', 'closed', 'other'],
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ['other', 'closed'].indexOf(ccc.case.status) !== -1)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 6,
            },
            {
              description: 'should filter by specified workers',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  counsellors: ['worker-1', 'worker-3'],
                },
              },
              sampleConfig: {
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                workers: ['worker-1', 'worker-2', 'worker-3', 'worker-4'],
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ['worker-1', 'worker-3'].indexOf(ccc.case.status) !== -1)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should filter out cases with no contact if includeOrphans filter is set false',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  includeOrphans: false,
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SIMPLE_SAMPLE_CONFIG,
                contactNames: [{ firstName: 'a', lastName: 'z' }, null],
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => ccc.case.connectedContacts.length > 0)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should only include cases with followUpDate prior to the followUpDate.to filter if specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  followUpDate: {
                    to: add(baselineDate, { days: 4, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                followUpDateGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      new Date(ccc.case.info.followUpDate) <
                      add(baselineDate, { days: 4, hours: 12 }),
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should only include cases with followUpDate between the followUpDate.from and the followUpDate.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  followUpDate: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(baselineDate, { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                followUpDateGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      new Date(ccc.case.info.followUpDate) >
                        add(baselineDate, { days: 2, hours: 12 }) &&
                      new Date(ccc.case.info.followUpDate) <
                        add(baselineDate, { days: 6, hours: 12 }),
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 4,
            },
            {
              description:
                'should exclude cases with followUpDate set as empty string if the followUpDate.from and the followUpDate.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  followUpDate: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(baselineDate, { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                followUpDateGenerator: idx =>
                  idx % 2 ? '' : addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(
                    ccc =>
                      ccc.case.info.followUpDate &&
                      new Date(ccc.case.info.followUpDate) >
                        add(baselineDate, { days: 2, hours: 12 }) &&
                      new Date(ccc.case.info.followUpDate) <
                        add(baselineDate, { days: 6, hours: 12 }),
                  )
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 2,
            },
            {
              description:
                'should only include cases without followUpDate set in followUpDate.exists: MUST_NOT_EXIST filter specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  followUpDate: {
                    exists: DateExistsCondition.MUST_NOT_EXIST,
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                followUpDateGenerator: idx =>
                  idx % 2 === 1 ? addDays(baselineDate, idx).toISOString() : undefined,
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => !ccc.case.info.followUpDate)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should count an empty string value as not existing followUpDate.exists: MUST_NOT_EXIST filter specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  followUpDate: {
                    exists: DateExistsCondition.MUST_NOT_EXIST,
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                followUpDateGenerator: idx =>
                  idx % 2 === 1 ? addDays(baselineDate, idx).toISOString() : '',
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .filter(ccc => !ccc.case.info.followUpDate)
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 5,
            },
            {
              description:
                'should not include cases with createdAt not between the createdAt.from and the createdAt.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  createdAt: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(baselineDate, { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                createdAtGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: () => [],
              expectedTotalCount: 0,
            },
            {
              description:
                'should include cases with createdAt between the createdAt.from and the createdAt.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  createdAt: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(new Date(), { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                createdAtGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts.sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 10,
            },
            {
              description:
                'should not include cases with updatedAt not between the updatedAt.from and the updatedAt.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  updatedAt: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(baselineDate, { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                updatedAtGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: () => [],
              expectedTotalCount: 0,
            },
            {
              description:
                'should include cases with updatedAt between the updatedAt.from and the updatedAt.to filter if both are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: {
                  updatedAt: {
                    from: add(baselineDate, { days: 2, hours: 12 }).toISOString(),
                    to: add(new Date(), { days: 6, hours: 12 }).toISOString(),
                  },
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                updatedAtGenerator: idx => addDays(baselineDate, idx).toISOString(),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts.sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id),
              expectedTotalCount: 10,
            },
            {
              description:
                'should include only cases matching category if one is specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: <CaseListFilters>{
                  categories: [{ category: 'a', subcategory: 'ab' }],
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                categoriesGenerator: idx => ({
                  a: ['aa', ...(!!(idx % 2) ? ['ab'] : [])],
                  b: !(idx % 3) ? ['ba'] : [],
                }),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .filter(ccc => ccc.contact.rawJson.categories.a.includes('ab')),
              expectedTotalCount: 5,
            },
            {
              description:
                'should include only cases matching any category if multiple are specified',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: <CaseListFilters>{
                  categories: [
                    { category: 'a', subcategory: 'ab' },
                    { category: 'b', subcategory: 'ba' },
                    { category: 'b', subcategory: 'bb' },
                  ],
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                categoriesGenerator: idx => ({
                  a: ['aa', ...(!(idx % 2) ? ['ab'] : [])],
                  b: !(idx % 3) ? ['ba'] : [],
                }),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .filter(
                    ccc =>
                      ccc.contact.rawJson.categories.a.includes('ab') ||
                      ccc.contact.rawJson.categories.b.includes('ba') ||
                      ccc.contact.rawJson.categories.b.includes('bb'),
                  ),
              expectedTotalCount: 7,
            },
            {
              description: 'should allow any characters in categories and subcategories',
              searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
              body: {
                filters: <CaseListFilters>{
                  categories: [
                    { category: 'a', subcategory: "a'b\n,.!\t:{}" },
                    { category: "'b\n\r,.!\t:{}", subcategory: 'ba' },
                    { category: 'b', subcategory: 'bb' },
                  ],
                },
              },
              sampleConfig: <InsertSampleCaseSettings>{
                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                categoriesGenerator: idx => ({
                  a: ['aa', ...(!(idx % 2) ? ["a'b\n,.!\t:{}"] : [])],
                  "'b\n\r,.!	:{}": !(idx % 3) ? ['ba'] : [],
                }),
              },
              expectedCasesAndContacts: sampleCasesAndContacts =>
                sampleCasesAndContacts
                  .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
                  .filter(
                    ccc =>
                      ccc.contact.rawJson.categories.a.includes("a'b\n,.!\t:{}") ||
                      ccc.contact.rawJson.categories["'b\n\r,.!	:{}"].includes('ba') ||
                      ccc.contact.rawJson.categories["'b\n\r,.!	:{}"].includes('bb'),
                  ),
              expectedTotalCount: 7,
            },
          ];

          let createdCasesAndContacts: CaseWithContact[];
          afterEach(async () => {
            await db.none(`DELETE FROM "Contacts" WHERE id IN ($<ids:csv>)`, {
              ids: createdCasesAndContacts.map(ccc => ccc.contact?.id).filter(id => id),
            });
            await db.none(`DELETE FROM "Cases" WHERE id IN ($<ids:csv>)`, {
              ids: createdCasesAndContacts.map(ccc => ccc.case.id),
            });
          });

          each(testCases.filter((tc, idx) => idx === 8)).test(
            '$description',
            async ({
              sampleConfig,
              body,
              searchRoute,
              expectedCasesAndContacts,
              expectedTotalCount,
            }) => {
              createdCasesAndContacts = await insertSampleCases(sampleConfig);
              const response = await request.post(searchRoute).set(headers).send(body);
              validateCaseListResponse(
                response,
                expectedCasesAndContacts(
                  createdCasesAndContacts.map(cc => ({
                    case: cc.case,
                    contact: cc?.contact,
                  })),
                ),
                expectedTotalCount,
              );
            },
          );
        });
      });
    });

    each([
      {
        expectTranscripts: true,
        description: `with viewExternalTranscript includes transcripts`,
      },
      {
        expectTranscripts: false,
        description: `without viewExternalTranscript excludes transcripts`,
      },
    ]).test(`with connectedContacts $description`, async ({ expectTranscripts }) => {
      const createdCase = await caseApi.createCase(case1, accountSid, workerSid);
      let createdContact = await createContact(
        accountSid,
        workerSid,
        mocks.withTaskId,
        ALWAYS_CAN,
      );
      createdContact = await addConversationMediaToContact(
        accountSid,
        createdContact.id.toString(),
        mocks.conversationMedia,
        { user: twilioUser(workerSid, []), can: () => true },
      );
      await connectContactToCase(
        accountSid,
        workerSid,
        String(createdContact.id),
        String(createdCase.id),
        {
          user: twilioUser(workerSid, []),
          can: () => true,
        },
      );
      if (expectTranscripts) {
        console.log(createdContact);
      }

      useOpenRules();
      if (!expectTranscripts) {
        setRules(ruleFileActionOverride('viewExternalTranscript', false));
      }

      const response = await request
        .post(`${route}/search`)
        .query({ limit: 20, offset: 0 })
        .set(headers)
        .send({
          dateFrom: createdCase.createdAt,
          dateTo: createdCase.createdAt,
          firstName: 'withTaskId',
        });

      expect(response.status).toBe(200);

      expect(<caseApi.CaseService>response.body.cases).toHaveLength(1);

      if (expectTranscripts) {
        console.log(response.body.cases[0].connectedContacts);
        expect(
          (<caseApi.CaseService[]>response.body.cases).every(
            caseObj =>
              caseObj.connectedContacts?.every(
                c => c.conversationMedia?.some(isS3StoredTranscript),
              ),
          ),
        ).toBeTruthy();
      } else {
        expect(
          (<caseApi.CaseService[]>response.body.cases).every(
            caseObj =>
              caseObj.connectedContacts?.every(
                c => c.conversationMedia?.some(isS3StoredTranscript),
              ),
          ),
        ).toBeFalsy();
      }
    });
  });
});
