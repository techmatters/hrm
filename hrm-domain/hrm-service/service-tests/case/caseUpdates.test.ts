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

import { db } from '../../src/connection-pool';
import * as caseApi from '../../src/case/caseService';
import {
  createContact,
  connectContactToCase,
  addConversationMediaToContact,
} from '../../src/contact/contactService';
import { CaseService } from '../../src/case/caseService';
import * as caseDb from '../../src/case/caseDataAccess';
import { convertCaseInfoToExpectedInfo, without } from './caseValidation';
import { isBefore } from 'date-fns';

// const each = require('jest-each').default;
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as mocks from '../mocks';
import { ruleFileWithOneActionOverride } from '../permissions-overrides';
import { headers, getRequest, getServer, setRules, useOpenRules } from '../server';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { isS3StoredTranscript } from '../../src/conversation-media/conversation-media';
import { casePopulated } from '../mocks';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, case2, accountSid, workerSid } = mocks;

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {});

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

const cases: Record<string, CaseService> = {};
let nonExistingCaseId;
const route = `/v0/accounts/${accountSid}/cases`;

beforeEach(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  cases.blank = await caseApi.createCase(case1, accountSid, workerSid);
  cases.populated = await caseApi.createCase(casePopulated, accountSid, workerSid);

  const caseToBeDeleted = await caseApi.createCase(case2, accountSid, workerSid);
  nonExistingCaseId = caseToBeDeleted.id;
  await caseDb.deleteById(caseToBeDeleted.id, accountSid);
});

afterEach(async () => {
  await mockingProxy.start();
  await caseDb.deleteById(cases.blank.id, accountSid);
  await caseDb.deleteById(cases.populated.id, accountSid);
});

describe('PUT /cases/:id route', () => {
  const subRoute = id => `${route}/${id}`;
  const { counsellorNotes, perpetrators, households, incidents, referrals, documents } =
    casePopulated.info;

  test('should return 401', async () => {
    const response = await request.put(subRoute(cases.blank.id)).send(case1);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization failed');
  });

  type TestCase = {
    originalCase?: () => CaseService;
    caseUpdate?: Partial<CaseService> | (() => Partial<CaseService>);
    infoUpdate?: Partial<CaseService['info']>;
    changeDescription: string;
    customWorkerSid?: string;
    extraExpectations?: Partial<CaseService>;
  };

  const testCases: TestCase[] = [
    {
      caseUpdate: { status: 'closed' },
      changeDescription: 'status changed',
      extraExpectations: {
        statusUpdatedAt: expect.toParseAsDate(),
        statusUpdatedBy: workerSid,
        previousStatus: case1.status,
      },
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

    /* Disable until weird flake mocking out auth can be fixed{
      infoUpdate: { summary: 'To summarize....' },
      changeDescription: 'summary changed by another counselor',
      customWorkerSid: 'WK-another-worker-sid',
    },
    */
  ];

  each(testCases).test(
    'should return 200 when $changeDescription',
    async ({
      caseUpdate: caseUpdateParam = {},
      infoUpdate,
      originalCase: originalCaseGetter = () => cases.blank,
      customWorkerSid = undefined,
      extraExpectations = {},
    }: TestCase) => {
      if (customWorkerSid) {
        await mockingProxy.start();
        await mockSuccessfulTwilioAuthentication(customWorkerSid);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

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
        ...extraExpectations,
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
      expect(isBefore(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(true);
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
    let createdContact = await createContact(accountSid, workerSid, mocks.withTaskId, {
      user: twilioUser(workerSid, []),
      can: () => true,
    });
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

    if (!expectTranscripts) {
      setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
    } else {
      useOpenRules();
    }

    const response = await request.put(subRoute(createdCase.id)).set(headers).send({});

    expect(response.status).toBe(200);

    if (expectTranscripts) {
      expect(
        (<caseApi.CaseService>response.body).connectedContacts?.every(
          c => c.conversationMedia?.some(isS3StoredTranscript),
        ),
      ).toBeTruthy();
    } else {
      expect(
        (<caseApi.CaseService>response.body).connectedContacts?.every(
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

describe('PUT /cases/:id/status route', () => {
  const subRoute = id => `${route}/${id}/status`;

  test('should return 401', async () => {
    const response = await request
      .put(subRoute(cases.blank.id))
      .send({ status: 'anxious' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization failed');
  });

  type TestCase = {
    originalCase?: () => CaseService;
    newStatus: caseApi.CaseService['status'];
    changeDescription: string;
    customWorkerSid?: string;
    statusUpdatedAt: string | null;
    statusUpdatedBy: string | null;
    previousStatus: caseApi.CaseService['status'] | null;
  };

  const testCases: TestCase[] = [
    {
      changeDescription: 'status changed',
      newStatus: 'dappled',
      statusUpdatedAt: expect.toParseAsDate(),
      statusUpdatedBy: workerSid,
      previousStatus: case1.status,
    },
    /* Disable until weird flake mocking out auth can be fixed
    {
      changeDescription: 'status changed by another counselor',
      newStatus: 'puddled',
      statusUpdatedAt: expect.toParseAsDate(),
      statusUpdatedBy: 'WK-another-worker-sid',
      previousStatus: case1.status,
      customWorkerSid: 'WK-another-worker-sid',
    },*/
    {
      changeDescription:
        'status changed to the same status - status tracking not updated',
      newStatus: 'open',
      statusUpdatedAt: null,
      statusUpdatedBy: null,
      previousStatus: null,
    },
  ];

  each(testCases).test(
    'should return 200 and save new status when $changeDescription',
    async ({
      newStatus,
      originalCase: originalCaseGetter = () => cases.blank,
      customWorkerSid = undefined,
      statusUpdatedAt,
      statusUpdatedBy,
      previousStatus,
    }: TestCase) => {
      if (customWorkerSid) {
        await mockingProxy.start();
        await mockSuccessfulTwilioAuthentication(customWorkerSid);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      const originalCase = originalCaseGetter();
      const caseBeforeUpdate = await caseApi.getCase(originalCase.id, accountSid, {
        user: twilioUser(workerSid, []),
        can: () => true,
      });

      const response = await request.put(subRoute(originalCase.id)).set(headers).send({
        status: newStatus,
      });

      expect(response.status).toBe(200);
      const expected = {
        ...convertCaseInfoToExpectedInfo(originalCase),
        createdAt: expect.toParseAsDate(originalCase.createdAt),
        updatedAt: expect.toParseAsDate(),
        status: newStatus,
        updatedBy: customWorkerSid || workerSid,
        statusUpdatedAt,
        statusUpdatedBy,
        previousStatus,
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
      expect(isBefore(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(true);
      // Check that in each case, updatedAt is greater it was before
      expect(
        isBefore(new Date(caseBeforeUpdate.updatedAt), new Date(fromDb.updatedAt)),
      ).toBe(true);
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
