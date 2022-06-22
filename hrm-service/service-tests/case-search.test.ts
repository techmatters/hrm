/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
import { add, addDays, sub } from 'date-fns';

import * as caseApi from '../src/case/case';
import { Case, getCase } from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import { db } from '../src/connection-pool';
import {
  deleteCaseAudits,
  fillNameAndPhone,
  validateCaseListResponse,
  validateSingleCaseResponse,
} from './case-validation';
import { DateExistsCondition } from '../src/case/case-data-access';

const supertest = require('supertest');
const each = require('jest-each').default;
const expressApp = require('../src/app');
const models = require('../src/models');
const mocks = require('./mocks');

export const workerSid = 'worker-sid';
const server = expressApp.listen();
const request = supertest.agent(server);

const { case1, contact1, accountSid } = mocks;
const options = { context: { workerSid } };

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const { Contact } = models;

type CaseWithContact = {
  case: Case;
  contact: any;
};

type InsertSampleCaseSettings = {
  sampleSize: number;
  accounts: string[];
  helplines: string[];
  workers?: string[];
  statuses?: string[];
  cases?: Case[];
  contactNames?: { firstName: string; lastName: string }[];
  contactNumbers?: string[];
  createdAtGenerator?: (idx: number) => string;
  updatedAtGenerator?: (idx: number) => string;
  followUpDateGenerator?: (idx: number) => string;
};

const insertSampleCases = async ({
  sampleSize,
  accounts,
  helplines,
  workers = [workerSid],
  statuses = ['open'],
  cases = [case1],
  contactNames = [{ firstName: 'Maria', lastName: 'Silva' }],
  contactNumbers = ['+1-202-555-0184'],
  createdAtGenerator = () => undefined,
  updatedAtGenerator = () => undefined,
  followUpDateGenerator = () => undefined,
}: InsertSampleCaseSettings): Promise<CaseWithContact[]> => {
  const createdCasesAndContacts: CaseWithContact[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    const toCreate = {
      ...cases[i % cases.length],
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
    if (followUpDate) {
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
    let createdContact = undefined;
    if (contactNames[i % contactNames.length]) {
      createdContact = await Contact.create(
        fillNameAndPhone(
          {
            ...contact1,
            accountSid: accounts[i % accounts.length],
            helpline: helplines[i % helplines.length],
          },
          contactNames[i % contactNames.length],
          contactNumbers[i % contactNumbers.length],
        ),
        options,
      );
      createdContact.caseId = createdCase.id;
      await createdContact.save(options);
      createdCase = await getCase(createdCase.id, accounts[i % accounts.length]); // reread case from DB now it has a contact connected
    }
    createdCasesAndContacts.push({
      contact: createdContact,
      case: createdCase,
    });
  }
  return createdCasesAndContacts;
};

afterAll(done => {
  server.close(() => {
    done();
  });
});

beforeAll(async () => {
  await deleteCaseAudits(workerSid);
});

afterEach(async () => deleteCaseAudits(workerSid));

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
      let createdContact;

      beforeEach(async () => {
        createdCase = await caseApi.createCase(case1, accountSid, workerSid);

        createdContact = await Contact.create(fillNameAndPhone(contact1), options);
        createdContact.caseId = createdCase.id;
        await createdContact.save(options);
        createdCase = await getCase(createdCase.id, accountSid); // refresh case from DB now it has a contact connected
      });

      afterEach(async () => {
        await createdContact.destroy();
        await caseDb.deleteById(createdCase.id, accountSid);
      });

      // eslint-disable-next-line jest/expect-expect
      test('should return 200 when populated', async () => {
        const response = await request.get(route).set(headers);
        validateSingleCaseResponse(response, createdCase, createdContact);
      });
    });
    describe('With multiple records', () => {
      const CASE_SAMPLE_SIZE = 10;
      const createdCasesAndContacts = [];
      const accounts = ['ACCOUNT_SID_1', 'ACCOUNT_SID_2'];
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

      afterEach(async () => {
        await Contact.destroy({
          where: { id: createdCasesAndContacts.map(ccc => ccc.contact.id) },
        });
        await Promise.all([
          db.none(`DELETE FROM "Cases" WHERE id IN ($<ids:csv>)`, {
            ids: createdCasesAndContacts.map(ccc => ccc.case.id),
          }),
        ]);
      });

      // eslint-disable-next-line jest/expect-expect
      each([
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
          description: 'should return all cases for account & helpline when helpline is specified',
          listRoute: `/v0/accounts/${accounts[0]}/cases?helpline=${helplines[1]}`,
          expectedCasesAndContacts: () =>
            createdCasesAndContacts
              .filter(
                ccc => ccc.case.accountSid === accounts[0] && ccc.case.helpline === helplines[1],
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
                ccc => ccc.case.accountSid === accounts[0] && ccc.case.helpline === helplines[0],
              )
              .sort((ccc1, ccc2) => ccc2.case.id - ccc1.case.id)
              .slice(1, 2),
          expectedTotalCount: 2,
        },
      ]).test(
        '$description',
        async ({ listRoute, expectedCasesAndContacts, expectedTotalCount }) => {
          const response = await request.get(listRoute).set(headers);
          validateCaseListResponse(response, expectedCasesAndContacts(), expectedTotalCount);
        },
      );
    });
  });

  const withHouseholds = caseObject => ({
    ...caseObject,
    info: {
      ...caseObject.info,
      households: [
        {
          household: {
            firstName: 'Maria',
            lastName: 'Silva',
            phone1: '+1-202-555-0184',
          },
        },
        {
          household: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ],
    },
  });

  const withPerpetrators = caseObject => ({
    ...caseObject,
    info: {
      ...caseObject.info,
      perpetrators: [
        {
          perpetrator: {
            firstName: 'Maria',
            lastName: 'Silva',
          },
        },
        {
          perpetrator: {
            firstName: 'John',
            lastName: 'Doe',
            phone2: '+12025550184',
          },
        },
      ],
    },
  });

  describe('/cases/search route', () => {
    describe('POST', () => {
      describe('3 sample records', () => {
        let createdCase1;
        let createdCase2;
        let createdCase3;
        let createdContact;
        const subRoute = `${route}/search`;
        const searchTestRunStart = new Date().toISOString();

        beforeAll(async () => {
          createdCase1 = await caseApi.createCase(withHouseholds(case1), accountSid, workerSid);
          createdCase2 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase3 = await caseApi.createCase(withPerpetrators(case1), accountSid, workerSid);
          createdContact = await Contact.create(fillNameAndPhone(contact1), accountSid, workerSid);

          // Connects createdContact with createdCase2
          createdContact.caseId = createdCase2.id;
          await createdContact.save(options);
          // Get case 2 again, now a contact is connected
          createdCase2 = await caseApi.getCase(createdCase2.id, accountSid);
        });

        afterAll(async () => {
          await createdContact.destroy();
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
              dateTo: add(new Date(), { hours: 1 }).toISOString(), // flaky test as new Date() is bound at object creation time, which occurs before test execution. Adding 1 hour should be enough offset
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
          await caseApi.updateCase(createdCase2.id, { status: 'closed' }, accountSid, workerSid);
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);
          expect(response.body.cases.length).toBe(0);
          expect(response.body.count).toBe(0);
        });
      });

      describe('Test date filters', () => {
        let createdCase1;
        let createdCase2;
        let createdCase3;
        const subRoute = `${route}/search`;
        const searchTestRunStart = new Date().toISOString();
        const oneWeekAgo = sub(new Date(searchTestRunStart), { weeks: 1 }).toISOString();
        const oneWeekAhead = add(new Date(searchTestRunStart), { weeks: 1 }).toISOString();

        const updateCaseCreatedAt = (caseObject, date) =>
          `UPDATE "Cases" SET "createdAt" = '${date}' WHERE id = ${caseObject.id} RETURNING *`;

        beforeEach(async () => {
          createdCase1 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase2 = await caseApi.createCase(case1, accountSid, workerSid);
          createdCase3 = await caseApi.createCase(case1, accountSid, workerSid);

          // Alter createdAt dates to play with date filters
          createdCase1 = await db.task(t => t.one(updateCaseCreatedAt(createdCase1, oneWeekAgo)));
          createdCase3 = await db.task(t => t.one(updateCaseCreatedAt(createdCase3, oneWeekAhead)));
        });

        afterEach(async () => {
          await caseDb.deleteById(createdCase1.id, accountSid);
          await caseDb.deleteById(createdCase2.id, accountSid);
          await caseDb.deleteById(createdCase3.id, accountSid);
        });

        each([
          {
            description: 'All records should match when no date filters are added',
            body: {
              helpline: 'helpline',
            },
            getExpectedIds: () => [createdCase3.id, createdCase2.id, createdCase1.id],
          },
          {
            description: 'Only case created before (or at) oneWeekAgo should be returned',
            body: {
              helpline: 'helpline',
              dateTo: oneWeekAgo,
            },
            getExpectedIds: () => [createdCase1.id],
          },
          {
            description: 'Only cases created after oneWeekAgo should be returned',
            body: {
              helpline: 'helpline',
              dateFrom: add(new Date(oneWeekAgo), { seconds: 1 }),
            },
            getExpectedIds: () => [createdCase3.id, createdCase2.id],
          },
          {
            description: 'Only case created after (or at) oneWeekAhead should be returned',
            body: {
              helpline: 'helpline',
              dateFrom: oneWeekAhead,
            },
            getExpectedIds: () => [createdCase3.id],
          },
          {
            description: 'Only cases created before oneWeekAhead should be returned',
            body: {
              helpline: 'helpline',
              dateTo: sub(new Date(oneWeekAhead), { seconds: 1 }),
            },
            getExpectedIds: () => [createdCase2.id, createdCase1.id],
          },
          {
            description: 'Only cases created between [oneWeekAgo, oneWeekAhead] should be returned',
            body: {
              helpline: 'helpline',
              dateFrom: oneWeekAgo,
              dateTo: oneWeekAhead,
            },
            getExpectedIds: () => [createdCase3.id, createdCase2.id, createdCase1.id],
          },
          {
            description: 'Only case created between (oneWeekAgo, oneWeekAhead) should be returned',
            body: {
              helpline: 'helpline',
              dateFrom: add(new Date(oneWeekAgo), { seconds: 1 }),
              dateTo: sub(new Date(oneWeekAhead), { seconds: 1 }),
            },
            getExpectedIds: () => [createdCase2.id],
          },
          {
            description: 'No case should be returned (dateFrom)',
            body: {
              helpline: 'helpline',
              dateFrom: add(new Date(oneWeekAhead), { seconds: 1 }),
            },
            getExpectedIds: () => [],
          },
          {
            description: 'No case should be returned (dateTo)',
            body: {
              helpline: 'helpline',
              dateTo: sub(new Date(oneWeekAgo), { seconds: 1 }),
            },
            getExpectedIds: () => [],
          },
        ]).test('$description', async ({ body, getExpectedIds }) => {
          const response = await request
            .post(subRoute)
            .query({ limit: 20, offset: 0 })
            .set(headers)
            .send(body);

          expect(response.status).toBe(200);
          const ids = response.body.cases.map(c => c.id);
          expect(ids).toMatchObject(getExpectedIds());
        });
      });

      describe('Larger record set', () => {
        const baselineDate = new Date(2010, 6, 15);
        const accounts = ['ACCOUNT_SID_1', 'ACCOUNT_SID_2'];
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
              ...case1,
              info: { ...case1.info, perpetrators: [{ perpetrator: { phone1: '111 222 333' } }] },
            },
            {
              ...case1,
              info: { ...case1.info, perpetrators: [{ perpetrator: { phone1: '444 555 666' } }] },
            },
            case1,
            {
              ...case1,
              info: { ...case1.info, households: [{ household: { phone1: '111 222 333' } }] },
            },
          ],
        };
        const SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG: InsertSampleCaseSettings = {
          ...SIMPLE_SAMPLE_CONFIG,
          accounts: ['ACCOUNT_SID_1'],
          contactNumbers: [undefined, '111 222 333', '444 555 666', '111 222 333'],
        };
        each([
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
                  ccc => ccc.case.accountSid === accounts[0] && ccc.case.helpline === helplines[1],
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
                  ccc => ccc.case.accountSid === accounts[0] && ccc.case.helpline === helplines[0],
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
            description: 'should find phone number matches on attached households and perpetrators',
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
            description: 'should find phone number matches on attached households and perpetrators',
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
              'should only include cases with followUpDate after the followUpDate.from filter if specified',
            searchRoute: `/v0/accounts/${accounts[0]}/cases/search`,
            body: {
              filters: {
                followUpDate: {
                  from: add(baselineDate, { days: 4, hours: 12 }).toISOString(),
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
        ]).test(
          '$description',
          async ({
            sampleConfig,
            body,
            searchRoute,
            expectedCasesAndContacts,
            expectedTotalCount,
          }) => {
            const createdCasesAndContacts = await insertSampleCases(sampleConfig);
            try {
              const response = await request
                .post(searchRoute)
                .set(headers)
                .send(body);
              validateCaseListResponse(
                response,
                expectedCasesAndContacts(createdCasesAndContacts),
                expectedTotalCount,
              );
            } finally {
              await Contact.destroy({
                where: {
                  id: createdCasesAndContacts.filter(ccc => ccc.contact).map(ccc => ccc.contact.id),
                },
              });
              await db.none(`DELETE FROM "Cases" WHERE id IN ($<ids:csv>)`, {
                ids: createdCasesAndContacts.map(ccc => ccc.case.id),
              });
            }
          },
        );
      });
    });
  });
});
