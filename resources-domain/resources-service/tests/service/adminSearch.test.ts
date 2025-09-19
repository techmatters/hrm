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

import sqslite from 'sqslite';
import { adminHeaders, getInternalServer, getRequest, headers } from './server';
import { SearchReindexParams } from '../../src/admin/adminSearchService';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { addDays, parseISO, subDays } from 'date-fns';
import each from 'jest-each';
import { AccountSID } from '@tech-matters/types';
import { FlatResource, ResourcesJobType } from '@tech-matters/resources-types';
import { generateImportResource as newImportResourceGenerator } from '../mockResources';
import range from './range';

// TODO: needs to be converted to aws-sdk-v3
import { SQS } from 'aws-sdk';
import { db } from '../../src/connection-pool';
import { mockSsmParameters } from '@tech-matters/testing';
import { upsertImportedResource } from '../../src/import/importDataAccess';

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);

const WORKER_SID = 'WK-worker-sid';

const BASELINE_DATE = parseISO('2020-01-01T00:00:00.000Z');

const ACCOUNT_SIDS: AccountSID[] = range(3).map(accountIdx => `AC${accountIdx}` as const);

const sqsService = sqslite({});
const sqsClient = new SQS({
  endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
});

let testQueueUrl: URL;

beforeAll(async () => {
  await mockingProxy.start();
  await sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) });
  await mockSuccessfulTwilioAuthentication(WORKER_SID);
  const mockttp = await mockingProxy.mockttpServer();
  await mockSsmParameters(mockttp, [
    {
      pathPattern:
        /\/(test|local|development)\/xx-fake-1\/sqs\/jobs\/hrm-resources-search\/queue-url-index/,
      valueGenerator: () => testQueueUrl.toString(),
    },
  ]);
});

afterAll(async () =>
  Promise.all([mockingProxy.stop(), internalServer.close(), sqsService.close()]),
);

beforeEach(async () => {
  ACCOUNT_SIDS.forEach(accountSid => {
    process.env[`STATIC_KEY_${accountSid}`] = 'BBC';
  });

  const { QueueUrl } = await sqsClient
    .createQueue({
      QueueName: `test-hrm-resources-search-index-pending`,
    })
    .promise();
  testQueueUrl = new URL(QueueUrl!);
});

afterEach(async () => {
  await sqsClient
    .deleteQueue({
      QueueUrl: testQueueUrl.toString(),
    })
    .promise();
});

describe('POST /search/reindex', () => {
  const route = `/v0/resources/admin/search/reindex`;
  const dbResources = range(3).map(accountIdx => {
    const accountSid: AccountSID = `AC${accountIdx}`;
    const generateImportResource = newImportResourceGenerator(BASELINE_DATE, accountSid);
    const accountResources: FlatResource[] = range(10).map(resourceIdx => {
      return generateImportResource(
        resourceIdx,
        addDays(BASELINE_DATE, parseInt(resourceIdx) - 5),
      );
    });
    return [accountSid, accountResources] as const;
  });

  const sortedResources = dbResources
    .flatMap(([, resources]) => resources)
    .sort((a, b) => {
      if (a.lastUpdated === b.lastUpdated) {
        if (a.accountSid === b.accountSid) {
          return a.id > b.id ? 1 : -1;
        }
        return a.accountSid > b.accountSid ? 1 : -1;
      }
      return a.lastUpdated > b.lastUpdated ? 1 : -1;
    });

  type ParametersTestCase = {
    description: string;
    lastUpdatedFrom?: Date;
    lastUpdatedTo?: Date;
    accountSid?: AccountSID;
    resourceIds?: string[];
    expectedResourcesPublished: FlatResource[];
  };

  beforeAll(async () => {
    await db.task(tx =>
      tx.none(
        ACCOUNT_SIDS.map(
          accountSids => `INSERT INTO resources."ResourceReferenceStringAttributeValues" (id, "accountSid", "list", "value", "language")
                        VALUES (
                            'REF_1_2',
                            '${accountSids}',
                            'REFERENCE_LIST_1',
                            'REFERENCE_VALUE_2',
                            'REFERENCE_LANGUAGE')`,
        ).join('\n;'),
      ),
    );
    const upserter = upsertImportedResource();
    await Promise.all(
      dbResources.flatMap(([acc, accountResources]) =>
        accountResources.map(resource => upserter(acc, resource)),
      ),
    );
  });

  test('No static key - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest.post(route).send(requestBody).expect(401);
  });

  test('Incorrect static key - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest
      .post(route)
      .set({ ...adminHeaders, Authorization: `Basic C64` })
      .send(requestBody)
      .expect(401);
  });

  test('Twilio Flex creds - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest.post(route).set(headers).send(requestBody).expect(401);
  });

  const testCases: ParametersTestCase[] = [
    {
      description:
        'Only lastUpdatedFrom set - sends all resources updated after that date for any account to be reindexed',
      lastUpdatedFrom: BASELINE_DATE,
      expectedResourcesPublished: sortedResources.filter(
        resource => parseISO(resource.lastUpdated) >= BASELINE_DATE,
      ),
    },
    {
      description:
        'Only account set - sends all resources for that account to be reindexed',
      accountSid: 'AC2',
      expectedResourcesPublished: sortedResources.filter(
        resource => resource.accountSid === 'AC2',
      ),
    },
    {
      description:
        'Only lastUpdatedTo set - sends all resources updated before that date for any account to be reindexed',
      lastUpdatedTo: BASELINE_DATE,
      expectedResourcesPublished: sortedResources.filter(
        resource => parseISO(resource.lastUpdated) <= BASELINE_DATE,
      ),
    },
    {
      description:
        'Last lastUpdatedFrom and lastIndexTo set - sends all resources updated between those dates for any account to be reindexed',
      lastUpdatedFrom: subDays(BASELINE_DATE, 2),
      lastUpdatedTo: addDays(BASELINE_DATE, 3),
      expectedResourcesPublished: sortedResources.filter(
        resource =>
          parseISO(resource.lastUpdated) >= subDays(BASELINE_DATE, 2) &&
          parseISO(resource.lastUpdated) <= addDays(BASELINE_DATE, 3),
      ),
    },
    {
      description:
        'Last lastUpdatedFrom, lastIndexTo and accountSid set - sends all resources updated between those dates for the specified account to be reindexed',
      lastUpdatedFrom: subDays(BASELINE_DATE, 2),
      lastUpdatedTo: addDays(BASELINE_DATE, 3),
      accountSid: 'AC2',
      expectedResourcesPublished: sortedResources.filter(
        resource =>
          resource.accountSid === 'AC2' &&
          parseISO(resource.lastUpdated) >= subDays(BASELINE_DATE, 2) &&
          parseISO(resource.lastUpdated) <= addDays(BASELINE_DATE, 3),
      ),
    },
    {
      description:
        'Account and resource IDs set - sends specified resources for that account to be reindexed',
      accountSid: 'AC2',
      resourceIds: ['RESOURCE_1', 'RESOURCE_3', 'RESOURCE_5'],
      expectedResourcesPublished: sortedResources.filter(
        resource =>
          resource.accountSid === 'AC2' &&
          ['RESOURCE_1', 'RESOURCE_3', 'RESOURCE_5'].includes(resource.id),
      ),
    },
    {
      description:
        'Everything set - sends resources that match all filters to be reindexed',
      accountSid: 'AC2',
      resourceIds: ['RESOURCE_1', 'RESOURCE_3', 'RESOURCE_5'],
      lastUpdatedFrom: subDays(BASELINE_DATE, 2),
      lastUpdatedTo: addDays(BASELINE_DATE, 3),
      expectedResourcesPublished: sortedResources.filter(
        resource =>
          resource.accountSid === 'AC2' &&
          ['RESOURCE_1', 'RESOURCE_3', 'RESOURCE_5'].includes(resource.id) &&
          parseISO(resource.lastUpdated) >= subDays(BASELINE_DATE, 2) &&
          parseISO(resource.lastUpdated) <= addDays(BASELINE_DATE, 3),
      ),
    },
  ];

  each(testCases).test(
    '$description',
    async ({
      lastUpdatedFrom,
      lastUpdatedTo,
      accountSid,
      resourceIds,
      expectedResourcesPublished,
    }: ParametersTestCase) => {
      const requestBody: SearchReindexParams = {
        lastUpdatedFrom: lastUpdatedFrom?.toISOString(),
        lastUpdatedTo: lastUpdatedTo?.toISOString(),
        resourceIds,
        accountSid,
      };
      const { text } = await internalRequest
        .post(route)
        .set(adminHeaders)
        .send(requestBody)
        .expect(200);
      const receivedMessages: FlatResource[] = [];
      while (receivedMessages.length <= expectedResourcesPublished.length) {
        const { Messages } = await sqsClient
          .receiveMessage({
            QueueUrl: testQueueUrl.toString(),
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 0.5,
          })
          .promise();
        if (!Messages?.length) {
          break;
        }
        receivedMessages.push(
          ...(Messages ?? []).map(message => JSON.parse(message.Body ?? '')),
        );
      }
      expect(receivedMessages.length).toEqual(expectedResourcesPublished.length);
      const expectedMessages = expectedResourcesPublished.map(resource => ({
        accountSid: resource.accountSid,
        document: resource,
        jobType: ResourcesJobType.SEARCH_INDEX,
      }));
      expect(receivedMessages).toStrictEqual(expectedMessages);

      type PublishResult = {
        status: string;
        resourceAccountSid: string;
        resourceId: string;
        timestamp: Date;
      };

      const results: PublishResult[] = text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [timestamp, resourceAccountSid, resourceId, status] = line.split(',');
          return {
            timestamp: parseISO(timestamp),
            resourceAccountSid,
            resourceId,
            status,
          };
        });
      expect(results.every(({ status }) => status === 'Success')).toBeTruthy();
      expect(results.length).toEqual(expectedResourcesPublished.length);
    },
  );

  test('If resourceIds are specified but no accountSId, should return 400 and send nothing for reindexing', async () => {
    const requestBody: SearchReindexParams = {
      resourceIds: ['RESOURCE_1', 'RESOURCE_3', 'RESOURCE_5'],
    };
    await internalRequest.post(route).set(adminHeaders).send(requestBody).expect(400);
    const { Messages } = await sqsClient
      .receiveMessage({
        QueueUrl: testQueueUrl.toString(),
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0.5,
      })
      .promise();
    expect(Messages?.length ?? 0).toEqual(0);
  });
});
