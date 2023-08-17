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

import { db } from '../src/connection-pool';
import * as caseApi from '../src/case/case';
import { createContact, connectContactToCase } from '../src/contact/contact';
import { Case } from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import { convertCaseInfoToExpectedInfo, without } from './case-validation';
import { isBefore } from 'date-fns';

// const each = require('jest-each').default;
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as mocks from './mocks';
import { ruleFileWithOneActionOverride } from './permissions-overrides';
import { headers, getRequest, getServer, setRules, useOpenRules } from './server';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { isS3StoredTranscript } from '../src/conversation-media/conversation-media';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, case2, accountSid, workerSid } = mocks;

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

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteContactById = (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
      DELETE FROM "Contacts"
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
  `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteJobsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "ContactJobs"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

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
      const response = await request.post(route).set(headers).send(case1);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual(expected);
      // Check the DB is actually updated
      const fromDb = await caseApi.getCase(response.body.id, accountSid, {
        user: twilioUser(workerSid, []),
        can: () => true,
      });
      expect(fromDb).toStrictEqual(expected);
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
        const response = await request
          .get(subRoute(cases.populated.id))
          .set({ ...headers });

        expect(response.status).toBe(200);

        const expected = {
          ...convertCaseInfoToExpectedInfo(cases.populated),
          createdAt: expect.toParseAsDate(cases.populated.createdAt),
          updatedAt: expect.toParseAsDate(cases.populated.createdAt),
        };

        expect(response.body).toMatchObject(expected);
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
        const createdContact = await createContact(
          accountSid,
          workerSid,
          mocks.withTaskIdAndTranscript,
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

        if (!expectTranscripts) {
          setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
        } else {
          useOpenRules();
        }

        const response = await request.get(subRoute(createdCase.id)).set(headers);

        expect(response.status).toBe(200);

        if (expectTranscripts) {
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.conversationMedia?.some(isS3StoredTranscript),
            ),
          ).toBeTruthy();
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.rawJson?.conversationMedia?.some(cm => cm.store === 'S3'),
            ),
          ).toBeTruthy();
        } else {
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.conversationMedia?.some(isS3StoredTranscript),
            ),
          ).toBeFalsy();
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.rawJson?.conversationMedia?.some(cm => cm.store === 'S3'),
            ),
          ).toBeFalsy();
        }

        await deleteJobsByContactId(createdContact.id, createdContact.accountSid);
        await deleteContactById(createdContact.id, createdContact.accountSid);
        await caseDb.deleteById(createdCase.id, accountSid);
        useOpenRules();
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
          changeDescription: 'summary changed by another counselor',
          customWorkerSid: 'WK-another-worker-sid',
        },
      ]).test(
        'should return 200 when $changeDescription',
        async ({
          caseUpdate: caseUpdateParam = {},
          infoUpdate,
          originalCase: originalCaseGetter = () => cases.blank,
          customWorkerSid = undefined,
        }) => {
          const caseUpdate =
            typeof caseUpdateParam === 'function' ? caseUpdateParam() : caseUpdateParam;
          const originalCase = originalCaseGetter();
          const update = {
            ...caseUpdate,
          };
          if (infoUpdate) {
            update.info = { ...originalCase.info, ...caseUpdate.info, ...infoUpdate };
          }
          const caseBeforeUpdate = await caseApi.getCase(originalCase.id, accountSid, {
            user: twilioUser(workerSid, []),
            can: () => true,
          });

          await mockSuccessfulTwilioAuthentication(customWorkerSid ?? workerSid);
          const response = await request
            .put(subRoute(originalCase.id))
            .set(headers)
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
          const fromDb = await caseApi.getCase(originalCase.id, accountSid, {
            user: twilioUser(workerSid, []),
            can: () => true,
          });
          expect(fromDb).toMatchObject(expected);

          if (!fromDb || !caseBeforeUpdate) {
            throw new Error('fromDB is falsy');
          }

          // Check that in each case, createdAt is not changed
          expect(fromDb.createdAt).toStrictEqual(caseBeforeUpdate.createdAt);
          // Check that in each case, updatedAt is greater than createdAt
          expect(isBefore(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(
            true,
          );
          // Check that in each case, updatedAt is greater it was before
          expect(
            isBefore(new Date(caseBeforeUpdate.updatedAt), new Date(fromDb.updatedAt)),
          ).toBe(true);
        },
      );

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
        const createdContact = await createContact(
          accountSid,
          workerSid,
          mocks.withTaskIdAndTranscript,
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

        if (!expectTranscripts) {
          setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
        } else {
          useOpenRules();
        }

        await mockSuccessfulTwilioAuthentication(workerSid);
        const response = await request
          .put(subRoute(createdCase.id))
          .set(headers)
          .send({});

        expect(response.status).toBe(200);

        if (expectTranscripts) {
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.conversationMedia?.some(isS3StoredTranscript),
            ),
          ).toBeTruthy();
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.rawJson?.conversationMedia?.some(cm => cm.store === 'S3'),
            ),
          ).toBeTruthy();
        } else {
          expect(
            (<caseApi.Case>response.body).connectedContacts?.every(
              c => c.conversationMedia?.some(isS3StoredTranscript),
            ),
          ).toBeFalsy();
        }

        await deleteJobsByContactId(createdContact.id, createdContact.accountSid);
        await deleteContactById(createdContact.id, createdContact.accountSid);
        await caseDb.deleteById(createdCase.id, accountSid);
        useOpenRules();
      });

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
