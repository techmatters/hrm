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

import { db } from '@tech-matters/hrm-core/connection-pool';
import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import {
  createContact,
  connectContactToCase,
  addConversationMediaToContact,
} from '@tech-matters/hrm-core/contact/contactService';
import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import { convertCaseInfoToExpectedInfo } from './case/caseValidation';

import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import * as mocks from './mocks';
import { ruleFileActionOverride } from './permissions-overrides';
import { headers, getRequest, getServer, setRules, useOpenRules } from './server';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { isS3StoredTranscript } from '@tech-matters/hrm-core/conversation-media/conversation-media';
import { ALWAYS_CAN } from './mocks';
import { casePopulated } from './mocks';
import { setupTestQueues } from './sqs';
const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';

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
  const mockttp = await mockingProxy.mockttpServer();
  await mockSsmParameters(mockttp, [
    {
      pathPattern: /.*\/queue-url-consumer$/,
      valueGenerator: () => SEARCH_INDEX_SQS_QUEUE_NAME,
    },
  ]);
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

setupTestQueues([SEARCH_INDEX_SQS_QUEUE_NAME]);

describe('/cases route', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

  describe('POST', () => {
    const expected: CaseService = {
      ...convertCaseInfoToExpectedInfo({ ...case1, info: {} }),
      id: expect.anything(),
      updatedAt: expect.toParseAsDate(),
      createdAt: expect.toParseAsDate(),
      precalculatedPermissions: {
        userOwnsContact: false,
      },
      updatedBy: null,
      statusUpdatedAt: null,
      statusUpdatedBy: null,
      previousStatus: null,
      categories: {},
      info: {},
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
      const fromDb = await caseApi.getCase(response.body.id, accountSid, ALWAYS_CAN);
      expect(fromDb).toStrictEqual({ ...expected, sections: {}, connectedContacts: [] });
    });
  });

  describe('/cases/:id route', () => {
    const cases: Record<string, CaseService> = {};
    let nonExistingCaseId;
    let subRoute;

    beforeEach(async () => {
      cases.blank = await caseApi.createCase(
        case1,
        accountSid,
        workerSid,
        undefined,
        true,
      );
      cases.populated = await caseApi.createCase(
        casePopulated,
        accountSid,
        workerSid,
        undefined,
        true,
      );
      subRoute = id => `${route}/${id}`;

      const caseToBeDeleted = await caseApi.createCase(
        case2,
        accountSid,
        workerSid,
        undefined,
        true,
      );
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
          sections: {},
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
        const createdCase = await caseApi.createCase(
          case1,
          accountSid,
          workerSid,
          undefined,
          true,
        );
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
          { user: newTwilioUser(accountSid, workerSid, []), can: () => true },
        );

        await connectContactToCase(
          accountSid,
          String(createdContact.id),
          String(createdCase.id),
          {
            user: newTwilioUser(accountSid, workerSid, []),
            can: () => true,
          },
        );

        useOpenRules();
        if (!expectTranscripts) {
          setRules(ruleFileActionOverride('viewExternalTranscript', false));
        }

        const response = await request.get(subRoute(createdCase.id)).set(headers);

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
        const fromDb = await caseDb.getById(
          cases.blank.id,
          accountSid,
          newTwilioUser(accountSid, workerSid, ['supervisor']),
          [['everyone']],
        );
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
