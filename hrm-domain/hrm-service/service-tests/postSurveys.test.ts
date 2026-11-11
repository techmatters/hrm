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

import * as mocks from './mocks';
import { db } from './dbConnection';
import { create } from '@tech-matters/hrm-core/post-survey/postSurveyDataAccess';
import { headers, basicHeaders } from './server';
import { setupServiceTests } from './setupServiceTest';

const { accountSid } = mocks;
const countPostSurveys = async (
  contactTaskId: string,
  taskId: string,
): Promise<number> => {
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

const { request, internalRequest } = setupServiceTests();

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

      test('returns 401 if you try to use basic auth', async () => {
        const response = await request.get(shouldExist).set(basicHeaders);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('returns 401 if you try to fool it into allowing basic auth', async () => {
        const response = await request
          .get(`${shouldExist}?x=/postSurveys`)
          .set(basicHeaders);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
        const bookmarkResponse = await request
          .get(`${shouldExist}#/postSurveys`)
          .set(basicHeaders);

        expect(bookmarkResponse.status).toBe(401);
        expect(bookmarkResponse.body.error).toBe('Authorization failed');
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

    test('no auth should return 401', async () => {
      const response = await request.post(route).send(body);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('Valid bearer auth should add post survey to DB', async () => {
      const response = await request.post(route).set(headers).send(body);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(body.data);

      const matchingRowsCount = await countPostSurveys(contactTaskId, taskId);

      expect(matchingRowsCount).toBe(1);
    });

    test('Invalid basic auth should return 401', async () => {
      const response = await request
        .post(route)
        .set({ ...basicHeaders, Authorization: 'Basic ZX18' })
        .send(body);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('Valid basic auth should add post survey to DB', async () => {
      const response = await request.post(route).set(basicHeaders).send(body);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(body.data);

      const matchingRowsCount = await countPostSurveys(contactTaskId, taskId);

      expect(matchingRowsCount).toBe(2);
    });
  });
});

describe('PATCH /internal/v0/accounts/:accountSid/postSurveys/:taskId', () => {
  const contactTaskId = 'WTpatchcontact';
  const taskId = 'WTpatchsurvey';
  const route = `/internal/v0/accounts/${accountSid}/postSurveys/${taskId}`;

  test('no auth should return 401', async () => {
    const response = await internalRequest
      .patch(route)
      .send({ contactTaskId, data: { question: 'Answer' } });

    expect(response.status).toBe(401);
  });

  test('missing contactTaskId should return 400', async () => {
    const response = await internalRequest
      .patch(`/internal/v0/accounts/${accountSid}/postSurveys/WTnotexisting`)
      .set(basicHeaders)
      .send({ data: { question: 'Answer' } });

    expect(response.status).toBe(400);
    expect(await countPostSurveys(contactTaskId, 'WTnotexisting')).toBe(0);
  });

  test('creates the survey, then replaces its data on subsequent patches', async () => {
    const createResponse = await internalRequest
      .patch(route)
      .set(basicHeaders)
      .send({ contactTaskId, data: { first: 'Answer', second: 'Answer' } });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body).toMatchObject({
      contactTaskId,
      taskId,
      data: { first: 'Answer', second: 'Answer' },
    });

    const updateResponse = await internalRequest
      .patch(route)
      .set(basicHeaders)
      .send({ contactTaskId, data: { first: 'Changed answer' } });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: createResponse.body.id,
      contactTaskId,
      taskId,
      data: { first: 'Changed answer' },
      createdAt: createResponse.body.createdAt,
    });
    expect(new Date(updateResponse.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(createResponse.body.updatedAt).getTime(),
    );
    expect(await countPostSurveys(contactTaskId, taskId)).toBe(1);
  });

  test('missing contactTaskId on an existing survey should return 400 and leave it unchanged', async () => {
    const response = await internalRequest
      .patch(route)
      .set(basicHeaders)
      .send({ data: { first: 'Ignored answer' } });

    expect(response.status).toBe(400);
    const [saved] = await db.task(connection =>
      connection.any(
        `SELECT "data" FROM "PostSurveys" WHERE "accountSid" = $<accountSid> AND "taskId" = $<taskId>`,
        { accountSid, taskId },
      ),
    );
    expect(saved.data).toStrictEqual({ first: 'Changed answer' });
  });

  test('is not exposed on the public API', async () => {
    const response = await request
      .patch(`/v0/accounts/${accountSid}/postSurveys/${taskId}`)
      .set(headers)
      .send({ contactTaskId, data: {} });

    expect(response.status).toBe(404);
  });
});
