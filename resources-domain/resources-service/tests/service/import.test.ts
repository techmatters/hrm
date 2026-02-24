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

import { getInternalServer, getRequest, getServer, headers } from './server';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { db } from '../../src/connection-pool';
import range from './range';
import { parseISO, addHours, subHours, addSeconds, subSeconds } from 'date-fns';
import { AccountSID } from '@tech-matters/types';
import {
  FlatResource,
  ImportBatch,
  ImportProgress,
  ImportRequestBody,
  ResourcesJobType,
  TimeSequence,
  ReferrableResource,
} from '@tech-matters/resources-types';
import { internalHeaders } from './server';
import each from 'jest-each';
import { AssertionError } from 'assert';
import { UpsertImportedResourceResult } from '../../src/import/importDataAccess';
import { generateImportResource as newImportResourceGenerator } from '../mockResources';
import sqslite from 'sqslite';

// TODO: needs to be converted to aws-sdk-v3
import { SQS } from 'aws-sdk';
import { mockSsmParameters } from '@tech-matters/testing';

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);
const server = getServer();
const request = getRequest(server);

const sqsService = sqslite({});
const sqsClient = new SQS({
  endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
});

let testQueueUrl: URL;

const accountSid = 'AC000';
const workerSid = 'WK-worker-sid';

const baselineDate = parseISO('2020-01-01T00:00:00.000Z');
const generateImportResource = newImportResourceGenerator(baselineDate, accountSid);

const populateSampleDbReferenceValues = async (count: number, valuesPerList: number) => {
  const sql = range(count)
    .flatMap(listIdx =>
      range(valuesPerList).flatMap(
        valueIdx =>
          `INSERT INTO resources."ResourceReferenceStringAttributeValues"
            (id, "accountSid", "list", "value", "language", "info")
            VALUES (
              'REF_${listIdx}_${valueIdx}',
              'AC000',
              'REFERENCE_LIST_${listIdx}',
              'REFERENCE_VALUE_${valueIdx}',
              'REFERENCE_LANGUAGE',
              '{ "property": "VALUE" }');`,
      ),
    )
    .join(';\n');
  // console.log(sql); // handy for debugging
  await db.none(sql);
};

const populateSampleDbResources = async (count: number) => {
  const accountResourceIdTuples: [string, string[]][] = [['0', range(count)]];
  const testResourceCreateSql = accountResourceIdTuples
    .flatMap(([accountIdx, resourceIdxs]) =>
      resourceIdxs.flatMap(resourceIdx => {
        const sql = `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'AC00${accountIdx}', 'Resource ${resourceIdx} (Account AC00${accountIdx})')`;
        const attributeSql = range(parseInt(resourceIdx)).flatMap(attributeIdx =>
          range((parseInt(attributeIdx) % 2) + 1).flatMap(valueIdx => [
            `INSERT INTO resources."ResourceStringAttributes" ("resourceId", "accountSid", "key", "language", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'AC00${accountIdx}', 'ATTRIBUTE_${attributeIdx}', 'en-US', 'VALUE_${valueIdx}', '{ "some": "json" }')`,
            `INSERT INTO resources."ResourceDateTimeAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'AC00${accountIdx}', 'DATETIME_ATTRIBUTE_${attributeIdx}', '${addHours(
              baselineDate,
              parseInt(valueIdx),
            ).toISOString()}', '{ "some": "json" }')`,
            `INSERT INTO resources."ResourceNumberAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'AC00${accountIdx}', 'NUMBER_ATTRIBUTE_${attributeIdx}', ${valueIdx}, '{ "some": "json" }')`,
            parseInt(valueIdx) < 2
              ? `INSERT INTO resources."ResourceBooleanAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'AC00${accountIdx}', 'BOOL_ATTRIBUTE_${attributeIdx}', '${Boolean(
                  parseInt(valueIdx) % 2,
                )}', '{ "some": "json" }')`
              : '',
          ]),
        );
        return [sql, ...attributeSql];
      }),
    )
    .join(';\n');
  // console.log(testResourceCreateSql); // handy for debugging
  await db.multi(testResourceCreateSql);
};

/*
 * This function expects attributes to have been applied in a specific pattern (as defined in the beforeAll step):
 * - Each resource has a number of attributes equal to its index
 * - Even numbered attributes have 1 value, odd numbered attributes have 2 values
 * - Each value has the same info
 * - Each value has the same language
 */
const verifyGeneratedResourcesAttributesByType = (
  resource: ReferrableResource,
  expectedValue: (valueIdx: string) => string | boolean | number,
  attributePrefix: string = '',
  checkLanguage = true,
  maxValues = Number.MAX_SAFE_INTEGER,
) => {
  const [, resourceIdx] = resource.id.split('_');
  range(resourceIdx).forEach(attributeIdx => {
    const attribute = resource.attributes[`${attributePrefix}ATTRIBUTE_${attributeIdx}`];
    expect(attribute).toBeDefined();
    const expectedValues = Math.min((parseInt(attributeIdx) % 2) + 1, maxValues);
    if (Array.isArray(attribute)) {
      expect(attribute).toHaveLength(expectedValues);
      range(expectedValues).forEach(valueIdx => {
        expect(attribute[parseInt(valueIdx)]).toStrictEqual(
          checkLanguage
            ? {
                info: { some: 'json' },
                language: 'en-US',
                value: expectedValue(valueIdx),
              }
            : {
                info: { some: 'json' },
                value: expectedValue(valueIdx),
              },
        );
      });
    } else {
      throw new AssertionError({ message: 'Expected attribute value to be an array' });
    }
  });
};

const verifyGeneratedResourcesAttributes = async (resourceId: string) => {
  const response = await request
    .get(`/v0/accounts/${accountSid}/resources/resource/${resourceId}`)
    .set(headers);
  expect(response.status).toBe(200);
  const resource = response.body as ReferrableResource;
  verifyGeneratedResourcesAttributesByType(resource, valueIdx => `VALUE_${valueIdx}`);
  verifyGeneratedResourcesAttributesByType(
    resource,
    valueIdx => addHours(baselineDate, parseInt(valueIdx)).toISOString(),
    'DATETIME_',
    false,
  );
  verifyGeneratedResourcesAttributesByType(
    resource,
    valueIdx => Boolean(parseInt(valueIdx) % 2),
    'BOOL_',
    false,
    2,
  );
  verifyGeneratedResourcesAttributesByType(
    resource,
    valueIdx => parseInt(valueIdx),
    'NUMBER_',
    false,
  );
};

const generateApiResource = (
  resourceIdSuffix: string,
  additionalAttributes: ReferrableResource['attributes'] = {},
): ReferrableResource => ({
  id: `RESOURCE_${resourceIdSuffix}`,
  name: `Resource ${resourceIdSuffix}`,
  attributes: {
    STRING_ATTRIBUTE: [
      {
        value: 'VALUE',
        language: 'en-US',
        info: { some: 'json' },
      },
    ],
    DATETIME_ATTRIBUTE: [
      {
        value: baselineDate.toISOString(),
        info: { some: 'json' },
      },
    ],
    BOOL_ATTRIBUTE: [
      {
        value: true,
        info: { some: 'json' },
      },
    ],
    NUMBER_ATTRIBUTE: [
      {
        value: 1337,
        info: { some: 'json' },
      },
    ],
    REFERENCE_ATTRIBUTE: [
      {
        value: 'REFERENCE_VALUE_2',
        language: 'REFERENCE_LANGUAGE',
        info: { property: 'VALUE' },
      },
    ],
    ...additionalAttributes,
  },
});

const verifyImportState = async (expectedImportState?: ImportProgress) => {
  const result = await db.oneOrNone<{ ImportState: ImportProgress }>(
    `SELECT "importState" FROM resources."Accounts" WHERE "accountSid" = $<accountSid>`,
    { accountSid },
  );
  if (expectedImportState) {
    await expect(result).toStrictEqual({ importState: expectedImportState });
  } else {
    await expect(result).toBeFalsy();
  }
};

beforeAll(async () => {
  await mockingProxy.start();
  await sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) });
  const mockttp = await mockingProxy.mockttpServer();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await mockSsmParameters(mockttp, [
    {
      pathPattern:
        /\/(test|local|development)\/xx-fake-1\/sqs\/jobs\/hrm-resources-search\/queue-url-index/,
      valueGenerator: () => testQueueUrl.toString(),
    },
  ]);
});

afterAll(async () =>
  Promise.all([
    mockingProxy.stop(),
    internalServer.close(),
    server.close(),
    sqsService.close(),
  ]),
);

beforeEach(async () => {
  await db.multi(`
    DELETE FROM resources."Accounts";
    DELETE FROM resources."Resources";
    DELETE FROM resources."ResourceReferenceStringAttributeValues";
    DELETE FROM resources."ImportBatches";
    DELETE FROM resources."ImportErrors";
  `);
  await populateSampleDbReferenceValues(5, 3);
  await populateSampleDbResources(5);

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

const timeSequenceFromDate = (date: Date, sequence = 0): TimeSequence =>
  `${date.valueOf()}-${sequence}`;

const newDefaultTestBatch = () => ({
  toSequence: timeSequenceFromDate(addHours(baselineDate, 1)),
  fromSequence: timeSequenceFromDate(subHours(baselineDate, 2)),
  remaining: 100,
});

describe('POST /import', () => {
  const route = `/v0/accounts/${accountSid}/resources/import`;
  test('No static key - should return 401', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', baselineDate)],
      batch: newDefaultTestBatch(),
    };
    internalRequest.post(route).send(requestBody).expect(401);
  });

  test('Incorrect static key - should return 401', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', baselineDate)],
      batch: newDefaultTestBatch(),
    };
    internalRequest
      .post(route)
      .set({ ...internalHeaders, Authorization: `Basic C64` })
      .send(requestBody)
      .expect(401);
  });

  test('Flex bearer token - should return 401', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', baselineDate)],
      batch: newDefaultTestBatch(),
    };
    internalRequest.post(route).set(headers).send(requestBody).expect(401);
  });

  type ImportPostTestCaseParameters = {
    description: string;
    requestBody: ImportRequestBody;
    expectedResponse: UpsertImportedResourceResult[];
    expectedResourceUpdates: Record<string, ReferrableResource>;
    expectedBatchProgressState?: ImportProgress;
  };

  type BatchRecord = {
    batchId: string;
    batchContext: ImportBatch;
    accountSid: AccountSID;
    successCount: number;
    failureCount: number;
  };

  const testCases: ImportPostTestCaseParameters[] = [
    {
      description: 'No resources - should return 200 with no updates',
      requestBody: {
        importedResources: [],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [],
      expectedResourceUpdates: {},
    },
    {
      description:
        'Single new resource - should return 200 with single update, add a new resource to the DB and publish it to the resources search index queue',
      requestBody: {
        importedResources: [generateImportResource('100', addSeconds(baselineDate, 30))],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_100',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_100: generateApiResource('100'),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 30).toISOString(),
        lastProcessedId: 'RESOURCE_100',
      },
    },
    {
      description:
        'Several new resources - should return 200 with an update per resource, adds the new resources to the DB and publishes them to the search index queue',
      requestBody: {
        importedResources: [
          generateImportResource('100', addSeconds(baselineDate, 30)),
          generateImportResource('101', addSeconds(baselineDate, 45)),
        ],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_100',
          success: true,
        },
        {
          id: 'RESOURCE_101',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_100: generateApiResource('100'),
        RESOURCE_101: generateApiResource('101'),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 45).toISOString(),
        lastProcessedId: 'RESOURCE_101',
      },
    },
    {
      description:
        'Update single resource - should return 200 with single update, and replace a resource',
      requestBody: {
        importedResources: [generateImportResource('3', addSeconds(baselineDate, 40))],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_3',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_3: generateApiResource('3'),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 40).toISOString(),
        lastProcessedId: 'RESOURCE_3',
      },
    },
    {
      description:
        'Mixed batch of additions and replacements - should return 200 with updates, and replace or add where appropriate',
      requestBody: {
        importedResources: [
          generateImportResource('3', addSeconds(baselineDate, 40)),
          generateImportResource('100', addSeconds(baselineDate, 50)),
        ],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_3',
          success: true,
        },
        {
          id: 'RESOURCE_100',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_3: generateApiResource('3'),
        RESOURCE_100: generateApiResource('100'),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 50).toISOString(),
        lastProcessedId: 'RESOURCE_100',
      },
    },
    {
      description:
        'Resources out of order in batch - should return 200 with an update per resource and add the new resources to the DB',
      requestBody: {
        importedResources: [
          generateImportResource('100', addSeconds(baselineDate, 30)),
          generateImportResource('101', addSeconds(baselineDate, 15)),
        ],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_100',
          success: true,
        },
        {
          id: 'RESOURCE_101',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_100: generateApiResource('100'),
        RESOURCE_101: generateApiResource('101'),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 30).toISOString(),
        lastProcessedId: 'RESOURCE_100',
      },
    },
    {
      description:
        'Resources with reference values not defined in the DB - adds the resource but omits those values',
      requestBody: {
        importedResources: [
          generateImportResource('100', addSeconds(baselineDate, 30), {
            referenceStringAttributes: [
              {
                key: 'REFERENCE_ATTRIBUTE',
                value: 'NOT_A_REFERENCE_VALUE',
                language: 'REFERENCE_LANGUAGE',
                list: 'REFERENCE_LIST_1',
              },
              {
                key: 'REFERENCE_ATTRIBUTE',
                value: 'REFERENCE_VALUE_1',
                language: 'REFERENCE_LANGUAGE',
                list: 'REFERENCE_LIST_2',
              },
            ],
          }),
        ],
        batch: newDefaultTestBatch(),
      },
      expectedResponse: [
        {
          id: 'RESOURCE_100',
          success: true,
        },
      ],
      expectedResourceUpdates: {
        RESOURCE_100: generateApiResource('100', {
          REFERENCE_ATTRIBUTE: [
            {
              value: 'REFERENCE_VALUE_2',
              language: 'REFERENCE_LANGUAGE',
              info: { property: 'VALUE' },
            },
            {
              value: 'REFERENCE_VALUE_1',
              language: 'REFERENCE_LANGUAGE',
              info: { property: 'VALUE' },
            },
          ],
        }),
      },
      expectedBatchProgressState: {
        ...newDefaultTestBatch(),
        lastProcessedDate: addSeconds(baselineDate, 30).toISOString(),
        lastProcessedId: 'RESOURCE_100',
      },
    },
  ];

  each(testCases).test(
    '$description',
    async ({
      requestBody,
      expectedResponse,
      expectedResourceUpdates,
      expectedBatchProgressState,
    }: ImportPostTestCaseParameters) => {
      const { body, status } = await internalRequest
        .post(route)
        .set(internalHeaders)
        .send(requestBody);
      expect(status).toBe(200);
      expect(body).toStrictEqual(expectedResponse);
      for (let resourceIdx = 0; resourceIdx < 5; resourceIdx++) {
        const resourceId = `RESOURCE_${resourceIdx}`;
        if (!expectedResourceUpdates[resourceId]) {
          await verifyGeneratedResourcesAttributes(resourceId);
        }
      }

      for (const [resourceId, expectedResource] of Object.entries(
        expectedResourceUpdates,
      )) {
        const response = await request
          .get(`/v0/accounts/${accountSid}/resources/resource/${resourceId}`)
          .set(headers);
        expect(response.status).toBe(200);
        const resource = response.body as ReferrableResource;
        expect(resource).toStrictEqual(expectedResource);
      }
      await verifyImportState(expectedBatchProgressState);

      const { importedResources, batch } = requestBody;

      const receivedMessages: FlatResource[] = [];
      while (receivedMessages.length <= importedResources.length) {
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
      expect(receivedMessages.length).toEqual(importedResources.length);
      const expectedMessages = importedResources.map(resource => ({
        accountSid: resource.accountSid,
        document: resource,
        jobType: ResourcesJobType.SEARCH_INDEX,
      }));
      expect(receivedMessages).toStrictEqual(expectedMessages);

      const importBatchRecords = await db.task(async conn => {
        return conn.manyOrNone<BatchRecord>(`SELECT * FROM "resources"."ImportBatches"`);
      });
      if (importedResources.length) {
        expect(importBatchRecords.length).toBe(1);
        expect(importBatchRecords[0].batchId).toBe(
          `${batch.fromSequence}-${batch.toSequence}/${batch.remaining}`,
        );
        const resourcesByLastUpdatedDescending = [...importedResources].sort((r1, r2) =>
          r2.lastUpdated.localeCompare(r1.lastUpdated),
        );
        const latestResource = resourcesByLastUpdatedDescending[0];

        expect(importBatchRecords[0].batchContext).toStrictEqual({
          ...batch,
          lastProcessedId: latestResource.id,
          lastProcessedDate: latestResource.lastUpdated,
        });
        expect(importBatchRecords[0].accountSid).toBe(accountSid);
        expect(importBatchRecords[0].successCount).toBe(importedResources.length);
        expect(importBatchRecords[0].failureCount).toBe(0);
      } else {
        expect(importBatchRecords.length).toBe(0);
      }
    },
  );

  const getResourceDbRecord = async (resourceId: string) =>
    db.oneOrNone<{ id: string; deletedAt: Date | null }>(
      `SELECT id, "deletedAt" FROM resources."Resources" WHERE id = $<resourceId> AND "accountSid" = $<accountSid>`,
      { resourceId, accountSid },
    );

  const receiveSqsMessages = async (expectedCount: number) => {
    const received: FlatResource[] = [];
    while (received.length < expectedCount) {
      const { Messages } = await sqsClient
        .receiveMessage({
          QueueUrl: testQueueUrl.toString(),
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 1,
        })
        .promise();
      if (!Messages?.length) break;
      received.push(...Messages.map(m => JSON.parse(m.Body ?? '')));
    }
    return received;
  };

  test('New resource with deletedAt - writes deletedAt to DB, GET returns 404, sends message to queue with deletedAt set', async () => {
    const deletedAt = addSeconds(baselineDate, 60).toISOString();
    const deletedResource: FlatResource = {
      ...generateImportResource('100', addSeconds(baselineDate, 30)),
      deletedAt,
    };
    const { body, status } = await internalRequest
      .post(route)
      .set(internalHeaders)
      .send({ importedResources: [deletedResource], batch: newDefaultTestBatch() });

    expect(status).toBe(200);
    expect(body).toStrictEqual([{ id: 'RESOURCE_100', success: true }]);

    // Deleted resource should not be returned by the GET endpoint
    const getResponse = await request
      .get(`/v0/accounts/${accountSid}/resources/resource/RESOURCE_100`)
      .set(headers);
    expect(getResponse.status).toBe(404);

    // Verify deletedAt is persisted in the DB
    const dbRecord = await getResourceDbRecord('RESOURCE_100');
    expect(dbRecord?.deletedAt?.toISOString()).toBe(deletedAt);

    // Verify the message sent to the queue includes deletedAt
    const receivedMessages = await receiveSqsMessages(1);
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toStrictEqual({
      accountSid: deletedResource.accountSid,
      document: deletedResource,
      jobType: ResourcesJobType.SEARCH_INDEX,
    });
  });

  test('Existing resource updated with deletedAt - updates deletedAt in DB, GET returns 404, sends message to queue with deletedAt set', async () => {
    // RESOURCE_3 already exists from populateSampleDbResources
    const deletedAt = addSeconds(baselineDate, 60).toISOString();
    const deletedResource: FlatResource = {
      ...generateImportResource('3', addSeconds(baselineDate, 40)),
      deletedAt,
    };
    const { body, status } = await internalRequest
      .post(route)
      .set(internalHeaders)
      .send({ importedResources: [deletedResource], batch: newDefaultTestBatch() });

    expect(status).toBe(200);
    expect(body).toStrictEqual([{ id: 'RESOURCE_3', success: true }]);

    // Soft-deleted resource should not be returned by the GET endpoint
    const getResponse = await request
      .get(`/v0/accounts/${accountSid}/resources/resource/RESOURCE_3`)
      .set(headers);
    expect(getResponse.status).toBe(404);

    // Verify deletedAt is persisted in the DB
    const dbRecord = await getResourceDbRecord('RESOURCE_3');
    expect(dbRecord?.deletedAt?.toISOString()).toBe(deletedAt);

    // Verify the message sent to the queue includes deletedAt
    const receivedMessages = await receiveSqsMessages(1);
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]).toStrictEqual({
      accountSid: deletedResource.accountSid,
      document: deletedResource,
      jobType: ResourcesJobType.SEARCH_INDEX,
    });
  });

  test('Mixed batch with deleted and non-deleted resources - handles each correctly', async () => {
    const deletedAt = addSeconds(baselineDate, 60).toISOString();
    const deletedResource: FlatResource = {
      ...generateImportResource('100', addSeconds(baselineDate, 30)),
      deletedAt,
    };
    const nonDeletedResource: FlatResource = generateImportResource(
      '101',
      addSeconds(baselineDate, 45),
    );
    const { body, status } = await internalRequest
      .post(route)
      .set(internalHeaders)
      .send({
        importedResources: [deletedResource, nonDeletedResource],
        batch: newDefaultTestBatch(),
      });

    expect(status).toBe(200);
    expect(body).toStrictEqual([
      { id: 'RESOURCE_100', success: true },
      { id: 'RESOURCE_101', success: true },
    ]);

    // Deleted resource should not be returned by GET
    const deletedGetResponse = await request
      .get(`/v0/accounts/${accountSid}/resources/resource/RESOURCE_100`)
      .set(headers);
    expect(deletedGetResponse.status).toBe(404);

    // Non-deleted resource should be returned by GET
    const nonDeletedGetResponse = await request
      .get(`/v0/accounts/${accountSid}/resources/resource/RESOURCE_101`)
      .set(headers);
    expect(nonDeletedGetResponse.status).toBe(200);

    // Verify deletedAt is persisted for the deleted resource
    const deletedDbRecord = await getResourceDbRecord('RESOURCE_100');
    expect(deletedDbRecord?.deletedAt?.toISOString()).toBe(deletedAt);

    // Verify deletedAt is null for the non-deleted resource
    const nonDeletedDbRecord = await getResourceDbRecord('RESOURCE_101');
    expect(nonDeletedDbRecord?.deletedAt).toBeNull();

    // Verify both messages are sent to the queue
    const receivedMessages = await receiveSqsMessages(2);
    expect(receivedMessages).toHaveLength(2);
    expect(receivedMessages).toStrictEqual([
      {
        accountSid: deletedResource.accountSid,
        document: deletedResource,
        jobType: ResourcesJobType.SEARCH_INDEX,
      },
      {
        accountSid: nonDeletedResource.accountSid,
        document: nonDeletedResource,
        jobType: ResourcesJobType.SEARCH_INDEX,
      },
    ]);
  });

  test('One malformed resource - rejects whole batch and returns 400', async () => {
    const { id, ...missingIdResource } = generateImportResource('3', baselineDate);
    const batch = newDefaultTestBatch();
    const requestBody: ImportRequestBody = {
      importedResources: [
        generateImportResource('2', subSeconds(baselineDate, 15)),
        missingIdResource as FlatResource,
        generateImportResource('4', addSeconds(baselineDate, 15)),
      ],
      batch,
    };
    const response = await internalRequest
      .post(route)
      .set(internalHeaders)
      .send(requestBody);
    expect(response.body).toStrictEqual({
      reason: 'missing field',
      fields: ['id'],
      resource: JSON.stringify(missingIdResource),
    });
    expect(response.status).toBe(400);
    for (let resourceIdx = 0; resourceIdx < 5; resourceIdx++) {
      const resourceId = `RESOURCE_${resourceIdx}`;
      await verifyGeneratedResourcesAttributes(resourceId);
    }

    const importBatchRecords = await db.task(async conn => {
      return conn.manyOrNone<BatchRecord>(`SELECT * FROM "resources"."ImportBatches"`);
    });

    expect(importBatchRecords.length).toBe(1);
    const [
      { batchId, batchContext, accountSid: batchAccountSid, failureCount, successCount },
    ] = importBatchRecords;
    expect(batchId).toBe(`${batch.fromSequence}-${batch.toSequence}/${batch.remaining}`);
    expect(batchContext).toStrictEqual(batch);
    expect(batchAccountSid).toBe(accountSid);
    expect(successCount).toBe(0);
    expect(failureCount).toBe(3);

    const importErrors = await db.task(async conn => {
      return conn.manyOrNone(`SELECT * FROM "resources"."ImportErrors"`);
    });

    expect(importErrors.length).toBe(1);
    const [
      {
        batchId: errorBatchId,
        rejectedBatch,
        error,
        resourceId,
        accountSid: errorAccountSid,
      },
    ] = importErrors;
    expect(errorBatchId).toBe(
      `${batch.fromSequence}-${batch.toSequence}/${batch.remaining}`,
    );

    expect(rejectedBatch).toStrictEqual(requestBody.importedResources);
    expect(resourceId).toBeFalsy();
    expect(errorAccountSid).toBe(accountSid);
    expect(error).toBeDefined();
  });
});

describe('GET /v0/accounts/:accountSid/import/progress', () => {
  const route = `/v0/accounts/${accountSid}/resources/import/progress`;
  const importRoute = `/v0/accounts/${accountSid}/resources/import`;
  test('No static key - should return 401', async () => {
    internalRequest.get(route).expect(401);
  });

  test('Incorrect static key - should return 401', async () => {
    internalRequest
      .get(route)
      .set({ ...internalHeaders, Authorization: `Basic C64` })
      .expect(401);
  });

  test('Flex bearer token - should return 401', async () => {
    internalRequest.get(route).set(headers).expect(401);
  });

  test('Nothing ever imported for account - returns 404', async () => {
    internalRequest.get(route).set(internalHeaders).expect(404);
  });

  test('Only attempted empty import - returns 404', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [],
      batch: newDefaultTestBatch(),
    };
    await internalRequest.post(importRoute).set(internalHeaders).send(requestBody);
    internalRequest.get(route).set(internalHeaders).expect(404);
  });

  test('Only attempted fail import - returns 404', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [
        generateImportResource('99', addSeconds(baselineDate, 60)),
        generateImportResource('100', addSeconds(baselineDate, 50)),
        generateImportResource('101', addSeconds(baselineDate, 50)),
      ],
      batch: newDefaultTestBatch(),
    };
    delete (requestBody.importedResources[0] as any).name;
    await internalRequest
      .post(importRoute)
      .set(internalHeaders)
      .send(requestBody)
      .expect(400);
    internalRequest.get(route).set(internalHeaders).expect(404);
  });

  test('Prior successful import - returns the importState set during that import', async () => {
    const expectedProgress = {
      ...newDefaultTestBatch(),
      lastProcessedDate: addSeconds(baselineDate, 50).toISOString(),
      lastProcessedId: 'RESOURCE_100',
    };
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', addSeconds(baselineDate, 50))],
      batch: newDefaultTestBatch(),
    };
    await internalRequest
      .post(importRoute)
      .set(internalHeaders)
      .send(requestBody)
      .expect(200);
    await verifyImportState(expectedProgress);
    const response = await internalRequest.get(route).set(internalHeaders);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expectedProgress);
  });

  test('Multiple prior successful imports - returns the importState set during the most recent import', async () => {
    const expectedProgress = {
      ...newDefaultTestBatch(),
      remaining: 99,
      lastProcessedDate: addSeconds(baselineDate, 40).toISOString(),
      lastProcessedId: 'RESOURCE_54',
    };
    const firstRequestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', addSeconds(baselineDate, 50))],
      batch: newDefaultTestBatch(),
    };
    const secondRequestBody: ImportRequestBody = {
      importedResources: [generateImportResource('54', addSeconds(baselineDate, 40))],
      batch: { ...newDefaultTestBatch(), remaining: 99 },
    };
    await internalRequest
      .post(importRoute)
      .set(internalHeaders)
      .send(firstRequestBody)
      .expect(200);
    await internalRequest
      .post(importRoute)
      .set(internalHeaders)
      .send(secondRequestBody)
      .expect(200);
    await verifyImportState(expectedProgress);

    const response = await internalRequest.get(route).set(internalHeaders);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expectedProgress);
  });
});
