/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
import { Case, getCase, WELL_KNOWN_CASE_SECTION_NAMES } from '../src/case/case';

const supertest = require('supertest');
const Sequelize = require('sequelize');
const each = require('jest-each').default;
const expressApp = require('../src/app');
const models = require('../src/models');
const mocks = require('./mocks');
import * as caseApi from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import { db } from '../src/connection-pool';

export {};
declare global {
  namespace jest {
    interface Matchers<R> {
      toParseAsDate(date: Date): R;
    }
    // @ts-ignore
    interface Expect<R> {
      toParseAsDate(date: Date): R;
    }
  }
}

expect.extend({
  toParseAsDate(received, date) {
    let receivedDate;
    try {
      receivedDate = received instanceof Date ? received : Date.parse(received);
    } catch (e) {
      return {
        pass: false,
        message: () => `Expected '${received}' to be a parseable date. Error: ${e}`,
      };
    }

    if (date) {
      const expectedDate = typeof date === 'string' ? Date.parse(date) : date;
      const pass = receivedDate.valueOf() === expectedDate.valueOf();
      return {
        pass,
        message: () => `Expected '${received}' to be the same as '${expectedDate.toISOString()}'`,
      };
    }

    return {
      pass: true,
      message: () => `Expected '${received}' to be a parseable date.`,
    };
  },
});

const server = expressApp.listen();
const request = supertest.agent(server);

const { case1, case2, contact1, accountSid } = mocks;
const workerSid = 'worker-sid';
const options = { context: { workerSid } };

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const { CaseAudit, Contact } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', workerSid],
    },
  },
};

const without = (original, ...property) => {
  if (!original) return original;
  const { ...output } = original;
  property.forEach(p => delete output[p]);
  return output;
};

const convertCaseInfoToExpectedInfo = (input: any) => {
  if (!input || !input.info) return { ...input };
  const expectedCase = {
    ...input,
    info: { ...input.info },
  };
  const { info: expectedInfo } = expectedCase;
  if (expectedInfo) {
    Object.keys(WELL_KNOWN_CASE_SECTION_NAMES).forEach(sectionName => {
      if (expectedInfo[sectionName]) {
        expectedInfo[sectionName] = expectedInfo[sectionName].map(section => ({
          id: expect.anything(),
          ...section,
          createdAt: expect.toParseAsDate(section.createdAt),
        }));
        if (sectionName === 'counsellorNotes') {
          expectedInfo.notes = expectedInfo.counsellorNotes.map(cn => cn.note);
        }
      }
    });
  }
  return expectedCase;
};

afterAll(done => {
  server.close(() => {
    done();
  });
});

beforeAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
});

afterEach(async () => CaseAudit.destroy(caseAuditsQuery));

describe('/cases route', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

  const fillNameAndPhone = contact => {
    const modifiedContact = {
      ...contact,
      rawJson: {
        ...contact.form,
        childInformation: {
          ...contact.form.childInformation,
          name: {
            firstName: 'Maria',
            lastName: 'Silva',
          },
        },
      },
      number: '+1-202-555-0184',
    };

    delete modifiedContact.form;

    return modifiedContact;
  };

  const validateCaseListResponse = (actual, expectedCaseAndContactModels, count) => {
    expect(actual.status).toBe(200);
    expect(actual.body).toStrictEqual(
      expect.objectContaining({
        cases: expect.arrayContaining([expect.anything()]),
        count,
      }),
    );
    expectedCaseAndContactModels.forEach(
      ({ case: expectedCaseModel, contact: expectedContactModel }, index) => {
        const { connectedContacts, ...caseDataValues } = expectedCaseModel;
        expect(actual.body.cases[index]).toMatchObject({
          ...caseDataValues,
          createdAt: expectedCaseModel.createdAt.toISOString(),
          updatedAt: expectedCaseModel.updatedAt.toISOString(),
        });
        expect(actual.body.cases[index].connectedContacts).toStrictEqual([
          expect.objectContaining({
            ...expectedContactModel.dataValues,
            csamReports: [],
            createdAt: expect.toParseAsDate(expectedContactModel.dataValues.createdAt),
            updatedAt: expect.toParseAsDate(expectedContactModel.dataValues.updatedAt),
          }),
        ]);
      },
    );
  };

  const validateSingleCaseResponse = (actual, expectedCaseModel, expectedContactModel) => {
    validateCaseListResponse(
      actual,
      [{ case: expectedCaseModel, contact: expectedContactModel }],
      1,
    );
  };
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
        for (let i = 0; i < CASE_SAMPLE_SIZE; i += 1) {
          const createdCase = await caseApi.createCase(
            {
              ...case1,
              helpline: helplines[i % helplines.length],
            },
            accounts[i % accounts.length],
            workerSid,
          );
          const createdContact = await Contact.create(
            fillNameAndPhone({
              ...contact1,
              accountSid: accounts[i % accounts.length],
              helpline: helplines[i % helplines.length],
            }),
            options,
          );
          createdContact.caseId = createdCase.id;
          await createdContact.save(options);
          const connectedCase = await getCase(createdCase.id, accounts[i % accounts.length]); // reread case from DB now it has a contact connected
          createdCasesAndContacts.push({
            contact: createdContact,
            case: connectedCase,
          });
        }
      });

      afterEach(async () => {
        await Promise.all([
          db.none(`DELETE FROM "Cases" WHERE id IN ($<ids:csv>)`, {
            ids: createdCasesAndContacts.map(ccc => ccc.case.id),
          }),
          Contact.destroy({ where: { id: createdCasesAndContacts.map(ccc => ccc.contact.id) } }),
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

  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(case1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(case1);

      expect(response.status).toBe(200);
      const expected = {
        ...convertCaseInfoToExpectedInfo(case1),
        id: expect.anything(),
        updatedAt: expect.toParseAsDate(),
        createdAt: expect.toParseAsDate(),
        categories: {},
        connectedContacts: [],
        childName: '',
      };

      expect(response.body).toStrictEqual(expected);
      // Check the DB is actually updated
      const fromDb = await caseApi.getCase(response.body.id, accountSid);
      expect(fromDb).toStrictEqual(expected);
    });

    test('should create a CaseAudit', async () => {
      const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);
      const response = await request
        .post(route)
        .set(headers)
        .send(case1);

      const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
      const byGreaterId = (a, b) => b.id - a.id;
      const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
      const { previousValue, newValue } = lastCaseAudit;

      expect(response.status).toBe(200);
      expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
      expect(previousValue).toBeNull();
      expect(newValue.info).toStrictEqual(case1.info);
      expect(newValue.helpline).toStrictEqual(case1.helpline);
      expect(newValue.status).toStrictEqual(case1.status);
      expect(newValue.twilioWorkerId).toStrictEqual(case1.twilioWorkerId);
    });
  });

  describe('/cases/:id route', () => {
    const counsellorNotes = [
      {
        id: '1',
        note: 'Child with covid-19',
        twilioWorkerId: 'note-adder',
        createdAt: '2022-01-01 00:00:00',
      },
      {
        id: '2',
        note: 'Child recovered from covid-19',
        twilioWorkerId: 'other-note-adder',
        createdAt: '2022-01-05 00:00:00',
      },
    ];
    const perpetrators = [
      {
        perpetrator: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
        createdAt: '2021-03-15T20:56:22.640Z',
        twilioWorkerId: 'perpetrator-adder',
      },
      {
        perpetrator: {
          firstName: 'J.',
          lastName: 'Doe',
          phone2: '+12345678',
        },
        createdAt: '2021-03-16T20:56:22.640Z',
        twilioWorkerId: 'perpetrator-adder',
      },
    ];

    const households = [
      {
        household: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
        createdAt: '2021-03-15T20:56:22.640Z',
        twilioWorkerId: 'household-adder',
      },
      {
        household: {
          firstName: 'J.',
          lastName: 'Doe',
          phone2: '+12345678',
        },
        createdAt: '2021-03-16T20:56:22.640Z',
        twilioWorkerId: 'household-adder',
      },
    ];

    const incidents = [
      {
        incident: {
          date: '2021-03-03',
          duration: '',
          location: 'Other',
          isCaregiverAware: null,
          incidentWitnessed: null,
          reactionOfCaregiver: '',
          whereElseBeenReported: '',
          abuseReportedElsewhere: null,
        },
        createdAt: '2021-03-16T20:56:22.640Z',
        twilioWorkerId: 'incident-adder',
      },
    ];

    const referrals = [
      {
        id: '2503',
        date: '2021-02-18',
        comments: 'Referred to state agency',
        createdAt: '2021-02-19T21:38:30.911+00:00',
        referredTo: 'DREAMS',
        twilioWorkerId: 'referral-adder',
      },
    ];

    const documents = [
      {
        id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
        document: {
          comments: 'test file!',
          fileName: 'sample1.pdf',
        },
        createdAt: '2021-09-21T17:57:52.346Z',
        twilioWorkerId: 'document-adder',
      },
      {
        id: '10d21f35-142c-4538-92db-d558f80898ae',
        document: {
          comments: '',
          fileName: 'sample2.pdf',
        },
        createdAt: '2021-09-21T19:47:03.167Z',
        twilioWorkerId: 'document-adder',
      },
    ];

    const cases: Record<string, Case> = {};
    let nonExistingCaseId;
    let subRoute;

    beforeEach(async () => {
      cases.blank = await caseApi.createCase(case1, accountSid, workerSid);
      cases.populated = await caseApi.createCase(
        {
          ...case1,
          info: {
            summary: 'something summery',
            perpetrators,
            households,
            incidents,
            documents,
            referrals,
            counsellorNotes,
          },
        },
        accountSid,
        workerSid,
      );
      subRoute = id => `${route}/${id}`;

      const caseToBeDeleted = await caseApi.createCase(case2, accountSid, workerSid);
      nonExistingCaseId = caseToBeDeleted.id;
      await caseDb.deleteById(caseToBeDeleted.id, accountSid);
    });

    afterEach(async () => {
      await caseDb.deleteById(cases.blank.id, accountSid);
      await caseDb.deleteById(cases.populated.id, accountSid);
    });

    describe('PUT', () => {
      test('should return 401', async () => {
        const response = await request.put(subRoute(cases.blank.id)).send(case1);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      each([
        {
          caseUpdate: { status: 'closed' },
          changeDescription: 'status changed',
        },
        {
          infoUpdate: { summary: 'To summarize....' },
          changeDescription: 'summary changed',
        },
        {
          infoUpdate: {
            counsellorNotes,
          },
          changeDescription: 'counsellorNotes',
        },
        {
          infoUpdate: {
            perpetrators,
          },
          changeDescription: 'perpetrators added',
        },
        {
          infoUpdate: {
            households,
          },
          changeDescription: 'households added',
        },
        {
          infoUpdate: {
            incidents,
          },
          changeDescription: 'incidents added',
        },
        {
          infoUpdate: {
            referrals,
          },
          changeDescription: 'referrals added',
        },
        {
          infoUpdate: {
            documents,
          },
          changeDescription: 'documents added',
        },
        {
          infoUpdate: {
            referrals,
            documents,
            counsellorNotes,
            perpetrators,
            households,
            incidents,
          },
          changeDescription: 'multiple different case info items are added',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            counsellorNotes: [],
          },
          changeDescription: 'counsellorNotes deleted',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            counsellorNotes: [
              {
                id: '1',
                note: 'Child with pneumonia',
                twilioWorkerId: 'note-adder-1',
                createdAt: '2022-01-01 00:00:00',
              },
              {
                id: '2',
                note: 'Child recovered from pneumonia',
                twilioWorkerId: 'other-note-adder-1',
                createdAt: '2022-01-05 00:00:00',
              },
            ],
          },
          changeDescription: 'counsellorNotes modified',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            counsellorNotes: [
              {
                id: '3',
                note: 'Child with pneumonia',
                twilioWorkerId: 'note-adder-1',
                createdAt: '2022-01-01 00:00:00',
              },
              {
                id: '4',
                note: 'Child recovered from pneumonia',
                twilioWorkerId: 'other-note-adder-1',
                createdAt: '2022-01-05 00:00:00',
              },
            ],
          },
          changeDescription: 'counsellorNotes replaced',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            documents: [],
          },
          changeDescription: 'documents deleted',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            documents: [
              {
                id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
                document: {
                  comments: 'test file!',
                  fileName: 'sample1.pdf',
                },
                createdAt: '2021-09-21T17:57:52.346Z',
                twilioWorkerId: 'document-adder',
              },
            ],
          },
          changeDescription: 'documents partially deleted',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            documents: [
              {
                id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
                document: {
                  comments: 'test file!',
                  fileName: 'sample1.pdf',
                },
                createdAt: '2021-09-21T17:57:52.346Z',
                twilioWorkerId: 'document-adder',
              },
              {
                id: 'different',
                document: {
                  comments: '',
                  fileName: 'sample3.pdf',
                },
                createdAt: '2021-09-21T19:47:03.167Z',
                twilioWorkerId: 'document-adder',
              },
            ],
          },
          changeDescription: 'documents partially replaced',
        },
        {
          originalCase: () => cases.populated,
          caseUpdate: () => ({
            info: without(cases.populated.info, 'households'),
          }),
          changeDescription: 'households property removed',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            households: [
              {
                household: {
                  firstName: 'Jane',
                  lastName: 'Jones',
                },
                createdAt: '2021-03-15T20:56:22.640Z',
                twilioWorkerId: 'household-editor',
              },
              {
                household: {
                  firstName: 'John',
                  lastName: 'Smith',
                  phone2: '+87654321',
                },
                createdAt: '2021-03-16T20:56:22.640Z',
                twilioWorkerId: 'household-editor',
              },
            ],
          },
          changeDescription: 'households changed',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            perpetrators: [
              {
                perpetrator: {
                  firstName: 'Jane',
                  lastName: 'Jones',
                },
                createdAt: '2021-03-15T20:56:22.640Z',
                twilioWorkerId: 'household-editor',
              },
              {
                perpetrator: {
                  firstName: 'John',
                  lastName: 'Smith',
                  phone2: '+87654321',
                },
                createdAt: '2021-03-16T20:56:22.640Z',
                twilioWorkerId: 'household-editor',
              },
            ],
          },
          changeDescription: 'perpetrators changed',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            referrals: [
              {
                id: '2503',
                date: '2021-02-18',
                comments: 'Referred to state agency 2',
                createdAt: '2021-02-19T21:38:30.911+00:00',
                referredTo: 'DREAMS 2',
                twilioWorkerId: 'referral-editor',
              },
              {
                id: '2504',
                date: '2021-02-18',
                comments: 'Referred to support group',
                createdAt: '2021-02-19T21:39:30.911+00:00',
                referredTo: 'Test',
                twilioWorkerId: 'referral-editor',
              },
            ],
          },
          changeDescription: 'referral edited',
        },
        {
          originalCase: () => cases.populated,
          infoUpdate: {
            incidents: [],
          },
          changeDescription: 'incident deleted',
        },
      ]).test(
        'should return 200 when $changeDescription',
        async ({
          caseUpdate: caseUpdateParam = {},
          infoUpdate,
          originalCase: originalCaseGetter = () => cases.blank,
        }) => {
          const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);
          const caseUpdate =
            typeof caseUpdateParam === 'function' ? caseUpdateParam() : caseUpdateParam;
          const originalCase = originalCaseGetter();
          const update = {
            ...caseUpdate,
          };
          if (infoUpdate) {
            update.info = { ...originalCase.info, ...caseUpdate.info, ...infoUpdate };
          }
          const response = await request
            .put(subRoute(originalCase.id))
            .set(headers)
            .send(update);

          expect(response.status).toBe(200);
          const expected = {
            ...convertCaseInfoToExpectedInfo(originalCase),
            createdAt: expect.toParseAsDate(originalCase.createdAt),
            updatedAt: expect.toParseAsDate(),
            ...convertCaseInfoToExpectedInfo(update),
          };

          expect(response.body).toMatchObject(expected);

          // Check the DB is actually updated
          const fromDb = await caseApi.getCase(originalCase.id, accountSid);
          expect(fromDb).toMatchObject(expected);

          // Check change is audited
          const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
          expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
          const byGreaterId = (a, b) => b.id - a.id;
          const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
          const { previousValue, newValue } = lastCaseAudit;
          expect(previousValue).toStrictEqual({
            connectedContacts: [],
            contacts: [],
            ...convertCaseInfoToExpectedInfo(originalCase),
            createdAt: expect.toParseAsDate(originalCase.createdAt),
            updatedAt: expect.toParseAsDate(),
          });
          expect(newValue).toStrictEqual({
            connectedContacts: [],
            contacts: [],
            ...expected,
          });
        },
      );
      test('should return 404', async () => {
        const status = 'closed';
        const response = await request
          .put(subRoute(nonExistingCaseId))
          .set(headers)
          .send({ status });

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE', () => {
      test('should return 401', async () => {
        const response = await request.delete(subRoute(cases.blank.id)).send();

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });
      test('should return 200', async () => {
        const response = await request
          .delete(subRoute(cases.blank.id))
          .set(headers)
          .send();

        expect(response.status).toBe(200);

        // Check the DB is actually updated
        const fromDb = await caseDb.getById(cases.blank.id, accountSid);
        expect(fromDb).toBeFalsy();
      });
      test('should return 404', async () => {
        const response = await request
          .delete(subRoute(nonExistingCaseId))
          .set(headers)
          .send();

        expect(response.status).toBe(404);
      });
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
      let createdCase1;
      let createdCase2;
      let createdCase3;
      let createdContact;
      const subRoute = `${route}/search`;

      beforeEach(async () => {
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

      afterEach(async () => {
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

      test('should return 200 - search by name', async () => {
        const body = {
          helpline: 'helpline',
          firstName: 'maria',
          lastName: 'silva',
        };
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

      test('should return 200 - search by phone number', async () => {
        const body = {
          helpline: 'helpline',
          phoneNumber: '2025550184',
        };
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

      test('should return 200 - search by date', async () => {
        const body = {
          helpline: 'helpline',
          dateFrom: createdCase1.createdAt,
          dateTo: createdCase3.createdAt,
        };
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .set(headers)
          .send(body);

        expect(response.status).toBe(200);
        expect(response.body.count).toBeGreaterThan(3);
        const ids = response.body.cases.map(c => c.id);
        expect(ids).toContain(createdCase1.id);
        expect(ids).toContain(createdCase2.id);
        expect(ids).toContain(createdCase3.id);
      });

      // eslint-disable-next-line jest/expect-expect
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
    });
  });
});
