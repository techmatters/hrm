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

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  mockAllSns,
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { useOpenRules, getServer, getRequest, getInternalServer } from './server';
import { clearAllTables } from './dbCleanup';
// eslint-disable-next-line import/no-extraneous-dependencies
import { WorkerSID } from '@tech-matters/types';
import { setupTestQueues } from './sqs';
import { mockEntitySnsParameters } from './ssm';
import { workerSid } from './mocks';

const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';
const ENTITY_SNS_TOPIC_NAME = 'mock-entity-sns-topic';

export const setupServiceTests = (
  userTwilioWorkerId: WorkerSID = workerSid,
  queues = [SEARCH_INDEX_SQS_QUEUE_NAME],
) => {
  const server = getServer();
  const request = getRequest(server);

  const internalServer = getInternalServer();
  const internalRequest = getRequest(internalServer);

  beforeAll(async () => {
    const mockttp = await mockingProxy.mockttpServer();
    await clearAllTables();
    await mockingProxy.start();
    await mockSsmParameters(mockttp);
    await mockEntitySnsParameters(
      mockttp,
      SEARCH_INDEX_SQS_QUEUE_NAME,
      ENTITY_SNS_TOPIC_NAME,
    );
    await mockAllSns(mockttp);
  });

  afterAll(async () => {
    await Promise.all([mockingProxy.stop(), server.close()]);
  });

  beforeEach(async () => {
    await mockSuccessfulTwilioAuthentication(userTwilioWorkerId);
    useOpenRules();
  });

  afterEach(async () => {
    await clearAllTables();
  });

  return {
    ...setupTestQueues(queues),
    server,
    request,
    internalRequest,
    internalServer,
  };
};
