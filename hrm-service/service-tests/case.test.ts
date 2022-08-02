/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
import * as caseApi from '../src/case/case';
import { Case } from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import {
  convertCaseInfoToExpectedInfo,
  countCaseAudits,
  deleteCaseAudits,
  selectCaseAudits,
  without,
} from './case-validation';
import { isBefore } from 'date-fns';

const supertest = require('supertest');
const each = require('jest-each').default;
import expressApp from '../src/app';
const mocks = require('./mocks');

export const workerSid = 'worker-sid';
const server = expressApp.listen();
const request = supertest.agent(server);

const { case1, case2, accountSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
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

  describe('POST', () => {
    const expected = {
      ...convertCaseInfoToExpectedInfo(case1),
      id: expect.anything(),
      updatedAt: expect.toParseAsDate(),
      createdAt: expect.toParseAsDate(),
      updatedBy: null,
      categories: {},
      connectedContacts: [],
      childName: '',
    };

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
      expect(response.body).toStrictEqual(expected);
      // Check the DB is actually updated
      const fromDb = await caseApi.getCase(response.body.id, accountSid);
      expect(fromDb).toStrictEqual(expected);
    });

    test('should create a CaseAudit', async () => {
      const caseAuditPreviousCount = await countCaseAudits(workerSid);
      const response = await request
        .post(route)
        .set(headers)
        .send(case1);

      const caseAudits = await selectCaseAudits(workerSid);
      const byGreaterId = (a, b) => b.id - a.id;
      const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
      const { previousValue, newValue } = lastCaseAudit;

      expect(response.status).toBe(200);
      expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
      expect(previousValue).toBeNull();
      expect(newValue).toStrictEqual({ ...expected, contacts: [] });
    });
  });

  describe('/cases/:id route', () => {
    const counsellorNotes = [
      {
        id: '1',
        note: 'Child with covid-19',
        twilioWorkerId: 'note-adder',
        createdAt: '2022-01-01T00:00:00+00:00',
      },
      {
        id: '2',
        note: 'Child recovered from covid-19',
        twilioWorkerId: 'other-note-adder',
        createdAt: '2022-01-05T00:00:00+00:00',
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

    describe('GET', () => {
      test('should return 401', async () => {
        const response = await request.put(subRoute(cases.blank.id)).send(case1);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 404', async () => {
        const response = await request
          .get(subRoute('0000')) // Imposible to exist case
          .set({ ...headers });

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('NotFoundError: Not Found');
      });

      test('Should return 200', async () => {
        const response = await request.get(subRoute(cases.populated.id)).set({ ...headers });

        expect(response.status).toBe(200);

        const expected = {
          ...convertCaseInfoToExpectedInfo(cases.populated),
          createdAt: expect.toParseAsDate(cases.populated.createdAt),
          updatedAt: expect.toParseAsDate(cases.populated.createdAt),
        };

        expect(response.body).toMatchObject(expected);
      });
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
          changeDescription: 'counsellorNotes added',
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
                createdAt: '2022-01-01T00:00:00+00:00',
              },
              {
                id: '2',
                note: 'Child recovered from pneumonia',
                twilioWorkerId: 'other-note-adder-1',
                createdAt: '2022-01-05T00:00:00+00:00',
                custom: 'property',
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
                createdAt: '2022-01-01T00:00:00+00:00',
              },
              {
                id: '4',
                note: 'Child recovered from pneumonia',
                twilioWorkerId: 'other-note-adder-1',
                createdAt: '2022-01-05T00:00:00+00:00',
                custom: 'property',
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
                custom: 'property',
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
        {
          infoUpdate: { summary: 'To summarize....' },
          changeDescription: 'summary changed by another couselor',
          customWorkerSid: 'another-worker-sid',
        },
      ]).test(
        'should return 200 when $changeDescription',
        async ({
          caseUpdate: caseUpdateParam = {},
          infoUpdate,
          originalCase: originalCaseGetter = () => cases.blank,
          customWorkerSid = undefined,
        }) => {
          const caseAuditPreviousCount = await countCaseAudits(workerSid);
          const caseUpdate =
            typeof caseUpdateParam === 'function' ? caseUpdateParam() : caseUpdateParam;
          const originalCase = originalCaseGetter();
          const update = {
            ...caseUpdate,
          };
          if (infoUpdate) {
            update.info = { ...originalCase.info, ...caseUpdate.info, ...infoUpdate };
          }

          const caseBeforeUpdate = await caseApi.getCase(originalCase.id, accountSid);

          const response = await request
            .put(subRoute(originalCase.id))
            .set({ ...headers, ...(customWorkerSid && { 'test-user': customWorkerSid }) })
            .send(update);

          expect(response.status).toBe(200);
          const expected = {
            ...convertCaseInfoToExpectedInfo(originalCase),
            createdAt: expect.toParseAsDate(originalCase.createdAt),
            updatedAt: expect.toParseAsDate(),
            ...convertCaseInfoToExpectedInfo(update, accountSid),
            updatedBy: customWorkerSid || workerSid,
          };

          expect(response.body).toMatchObject(expected);

          // Check the DB is actually updated
          const fromDb = await caseApi.getCase(originalCase.id, accountSid);
          expect(fromDb).toMatchObject(expected);

          // Check that in each case, createdAt is not changed
          expect(fromDb.createdAt).toStrictEqual(caseBeforeUpdate.createdAt);
          // Check that in each case, updatedAt is greater than createdAt
          expect(isBefore(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(true);
          // Check that in each case, updatedAt is greater it was before
          expect(isBefore(new Date(caseBeforeUpdate.updatedAt), new Date(fromDb.updatedAt))).toBe(
            true,
          );

          // Check change is audited
          const caseAudits = await selectCaseAudits(workerSid);
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
});
