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

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import { convertCaseInfoToExpectedInfo } from './caseValidation';
import { isBefore } from 'date-fns';

// const each = require('jest-each').default;
import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import * as mocks from '../mocks';
import { headers, getRequest, getServer, useOpenRules } from '../server';
import { ALWAYS_CAN, casePopulated } from '../mocks';
import { clearAllTables } from '../dbCleanup';
import { setupTestQueues } from '../sqs';

const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, case2, accountSid, workerSid } = mocks;

const cases: Record<string, CaseService> = {};
let nonExistingCaseId;
const route = `/v0/accounts/${accountSid}/cases`;

beforeAll(clearAllTables);

beforeEach(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  const mockttp = await mockingProxy.mockttpServer();
  await mockSsmParameters(mockttp, [
    {
      pathPattern: /.*\/queue-url-consumer$/,
      valueGenerator: () => SEARCH_INDEX_SQS_QUEUE_NAME,
    },
  ]);
  cases.blank = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
  cases.populated = await caseApi.createCase(
    casePopulated,
    accountSid,
    workerSid,
    undefined,
    true,
  );

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
  await mockingProxy.stop();
  await clearAllTables();
});

setupTestQueues([SEARCH_INDEX_SQS_QUEUE_NAME]);

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
        await mockingProxy.stop();
        await mockingProxy.start();
        await mockSuccessfulTwilioAuthentication(customWorkerSid);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      const originalCase = originalCaseGetter();
      const caseBeforeUpdate = await caseApi.getCase(
        originalCase.id,
        accountSid,
        ALWAYS_CAN,
      );

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
      const fromDb = await caseApi.getCase(originalCase.id, accountSid, ALWAYS_CAN);
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

describe('PUT /cases/:id/overview route', () => {
  const subRoute = id => `${route}/${id}/overview`;
  const baselineDate = new Date('2020-01-01T00:00:00.000Z');

  test('should return 401', async () => {
    const response = await request.put(subRoute(cases.blank.id)).send({
      summary: 'wintery',
      childIsAtRisk: false,
      followUpDate: baselineDate.toISOString(),
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization failed');
  });

  type TestCase = {
    originalCase?: () => CaseService;
    newOverview: caseApi.CaseService['info'];
    changeDescription: string;
  };

  const testCases: TestCase[] = [
    {
      changeDescription: 'all overview properties changed',
      newOverview: {
        summary: 'dappled',
        childIsAtRisk: false,
        followUpDate: baselineDate.toISOString(),
      },
    },
    {
      changeDescription:
        'overview partially changed (omitted properties are not changed)',
      newOverview: {
        summary: 'autumnal',
      },
    },
    {
      changeDescription:
        'properties other than the known overview properties are specified (unrecognised properties are ignored)',
      newOverview: {
        summary: 'autumnal',
        somethingFrom: 'behind the veil',
      },
    },
    {
      changeDescription: 'dynamic properties are now supported and saved',
      newOverview: {
        summary: 'summary is required',
        customField1: 'custom value 1',
        customField2: 'custom value 2',
      },
    },
  ];

  each(testCases).test(
    'should return 200 and save overview updates when $changeDescription',
    async ({
      newOverview,
      originalCase: originalCaseGetter = () => cases.populated,
    }: TestCase) => {
      const originalCase = originalCaseGetter();
      const caseBeforeUpdate = await caseApi.getCase(
        originalCase.id,
        accountSid,
        ALWAYS_CAN,
      );

      const response = await request
        .put(subRoute(originalCase.id))
        .set(headers)
        .send(newOverview);

      expect(response.status).toBe(200);
      const expected: CaseService = {
        ...originalCase,
        info: {
          ...originalCase.info,
          ...newOverview,
        },
        updatedAt: expect.toParseAsDate(),
        updatedBy: workerSid,
      };

      expect(response.body).toStrictEqual(expected);

      // Check the DB is actually updated
      const fromDb = await caseApi.getCase(originalCase.id, accountSid, ALWAYS_CAN);
      expect(fromDb).toStrictEqual({ ...expected, sections: {}, connectedContacts: [] });

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

  test("should return 404 if case doesn't exist", async () => {
    const response = await request.put(subRoute(nonExistingCaseId)).set(headers).send({
      summary: 'wintery',
      childIsAtRisk: false,
      followUpDate: baselineDate.toISOString(),
    });

    expect(response.status).toBe(404);
  });

  test('should return 400 if followUpDate is not a valid date', async () => {
    const response = await request.put(subRoute(cases.populated.id)).set(headers).send({
      followUpDate: 'in a bit',
    });

    expect(response.status).toBe(400);
  });
});
