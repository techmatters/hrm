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

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';

import * as mocks from '../mocks';
import { headers } from '../server';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { ALWAYS_CAN } from '../mocks';
import { casePopulated } from '../mocks';
import { setupServiceTests } from '../setupServiceTest';

const { case1, case2, accountSid, workerSid } = mocks;

const { request } = setupServiceTests(workerSid);

describe('/cases route', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

  describe('POST', () => {
    const expected = {
      ...case1,
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
      label: 'Created case',
      info: {
        operatingArea: 'East',
      },
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
        .send({ ...case1, label: 'Created case' });

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual(expected);
      // Check the DB is actually updated
      const fromDb = await caseApi.getCase(response.body.id, accountSid, ALWAYS_CAN);
      expect(fromDb).toStrictEqual({ ...expected, connectedContacts: [] });
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
      await caseDb.deleteById(parseInt(caseToBeDeleted.id), accountSid);
    });

    describe('GET', () => {
      test('should return 401', async () => {
        const response = await request
          .put(subRoute(cases.blank.id.toString()))
          .send(case1);

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
          ...cases.populated,
          createdAt: expect.toParseAsDate(cases.populated.createdAt),
          updatedAt: expect.toParseAsDate(cases.populated.createdAt),
        };

        expect(response.body).toMatchObject(expected);
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
          parseInt(cases.blank.id),
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
