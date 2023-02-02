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

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as mocks from './mocks';
import { db } from '../src/connection-pool';
import { create } from '../src/post-survey/post-survey-data-access';
import { headers, getRequest, getServer, useOpenRules } from './server';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { accountSid, workerSid } = mocks;

const deleteAllPostSurveys = async () =>
  db.task(t =>
    t.none(`
      DELETE FROM "PostSurveys" WHERE "accountSid" = '${accountSid}';
  `),
  );

const countPostSurveys = async (contactTaskId: string, taskId: string): Promise<number> => {
  const row = await db.task(connection =>
    connection.any(
      `
        SELECT COUNT(*) FROM "PostSurveys" WHERE "accountSid" = $<accountSid> AND "contactTaskId" = $<contactTaskId> AND "taskId" = $<taskId>
    `,
      { accountSid, contactTaskId, taskId },
    ),
  );
  return parseInt(row[0].count);
};

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await deleteAllPostSurveys();
});

afterAll(async () => Promise.all([mockingProxy.stop(), deleteAllPostSurveys(), server.close()]));
// afterEach(async () => PostSurvey.destroy(postSurveys2DestroyQuery));

describe('/postSurveys route', () => {
  const route = `/v0/accounts/${accountSid}/postSurveys`;

  describe('/postSurveys/contactTaskId/:id route', () => {
    const body = {
      helpline: 'helpline',
      contactTaskId: 'WTaaaaaaaaaa',
      taskId: 'WTbbbbbbbbbb',
      data: { question: 'Some Answer' },
    };

    const subRoute = `${route}/contactTaskId`;
    const shouldExist = `${subRoute}/${body.contactTaskId}`;
    const shouldNotExist = `${subRoute}/one-that-not-exists`;

    beforeAll(async () => create(accountSid, body));

    describe('GET', () => {
      test('should return 401', async () => {
        const response = await request.get(shouldExist);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 200 (no matches)', async () => {
        const response = await request.get(shouldNotExist).set(headers);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
      });

      test('should return 200 (at least one match)', async () => {
        const response = await request.get(shouldExist).set(headers);

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveLength(0);
      });
    });
  });

  // First test post so database wont be empty
  describe('POST', () => {
    const helpline = 'helpline';
    const contactTaskId = 'WTxxxxxxxxxx';
    const taskId = 'WTyyyyyyyyyy';
    const data = { other_question: 'Some Other Answer' };

    const body = { helpline, contactTaskId, taskId, data };

    test('should return 401', async () => {
      const response = await request.post(route).send(body);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(body.data);

      const matchingRowsCount = await countPostSurveys(contactTaskId, taskId);

      expect(matchingRowsCount).toBe(1);
    });
  });
});
