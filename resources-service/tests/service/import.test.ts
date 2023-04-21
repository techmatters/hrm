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
import { ImportApiResource, ImportProgress, ImportRequestBody } from '@tech-matters/hrm-types';
import { internalHeaders } from './server';
import each from 'jest-each';
import { ReferrableResource } from '../../src/resource/resource-model';
import { AssertionError } from 'assert';
import { UpsertImportedResourceResult } from '../../src/import/importDataAccess';

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);
const server = getServer();
const request = getRequest(server);

const accountSid = 'AC000';
const workerSid = 'WK-worker-sid';

const baselineDate = parseISO('2020-01-01T00:00:00.000Z');

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

const generateImportResource = (
  resourceIdSuffix: string,
  updatedAt: Date,
  additionalAttributes: Partial<ImportApiResource['attributes']> = {},
): ImportApiResource => ({
  id: `RESOURCE_${resourceIdSuffix}`,
  name: `Resource ${resourceIdSuffix}`,
  updatedAt: updatedAt.toISOString(),
  attributes: {
    ResourceStringAttributes: [
      {
        key: 'STRING_ATTRIBUTE',
        value: 'VALUE',
        language: 'en-US',
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceStringAttributes ?? []),
    ],
    ResourceDateTimeAttributes: [
      {
        key: 'DATETIME_ATTRIBUTE',
        value: baselineDate.toISOString(),
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceDateTimeAttributes ?? []),
    ],
    ResourceNumberAttributes: [
      {
        key: 'NUMBER_ATTRIBUTE',
        value: 1337,
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceNumberAttributes ?? []),
    ],
    ResourceBooleanAttributes: [
      {
        key: 'BOOL_ATTRIBUTE',
        value: true,
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceBooleanAttributes ?? []),
    ],
    ResourceReferenceStringAttributes: [
      {
        key: 'REFERENCE_ATTRIBUTE',
        value: 'REFERENCE_VALUE_2',
        language: 'REFERENCE_LANGUAGE',
        list: 'REFERENCE_LIST_1',
      },
      ...(additionalAttributes.ResourceReferenceStringAttributes ?? []),
    ],
  },
});

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
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => Promise.all([mockingProxy.stop(), internalServer.close(), server.close()]));

beforeEach(async () => {
  await db.multi(`
    DELETE FROM resources."Accounts";
    DELETE FROM resources."Resources";
    DELETE FROM resources."ResourceReferenceStringAttributeValues";
  `);
  await populateSampleDbReferenceValues(5, 3);
  await populateSampleDbResources(5);
});

const newDefaultTestBatch = () => ({
  toDate: addHours(baselineDate, 1).toISOString(),
  fromDate: subHours(baselineDate, 2).toISOString(),
  total: 100,
});

describe('POST /import', () => {
  const route = `/v0/accounts/${accountSid}/resources/import`;
  test('No static key - should return 401', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', baselineDate)],
      batch: newDefaultTestBatch(),
      accountSid,
    };
    internalRequest
      .post(route)
      .send(requestBody)
      .expect(401);
  });

  test('Incorrect static key - should return 401', async () => {
    const requestBody: ImportRequestBody = {
      importedResources: [generateImportResource('100', baselineDate)],
      batch: newDefaultTestBatch(),
      accountSid,
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
      accountSid,
    };
    internalRequest
      .post(route)
      .set(headers)
      .send(requestBody)
      .expect(401);
  });

  type ImportPostTestCaseParameters = {
    description: string;
    requestBody: ImportRequestBody;
    expectedResponse: UpsertImportedResourceResult[];
    expectedResourceUpdates: Record<string, ReferrableResource>;
    expectedBatchProgressState?: ImportProgress;
  };

  const testCases: ImportPostTestCaseParameters[] = [
    {
      description: 'No resources - should return 200 with no updates',
      requestBody: {
        importedResources: [],
        batch: newDefaultTestBatch(),
        accountSid,
      },
      expectedResponse: [],
      expectedResourceUpdates: {},
    },
    {
      description:
        'Single new resource - should return 200 with single update, and add a new resource to the DB',
      requestBody: {
        importedResources: [generateImportResource('100', addSeconds(baselineDate, 30))],
        batch: newDefaultTestBatch(),
        accountSid,
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
        'Several new resources - should return 200 with an update per resource and add the new resources to the DB',
      requestBody: {
        importedResources: [
          generateImportResource('100', addSeconds(baselineDate, 30)),
          generateImportResource('101', addSeconds(baselineDate, 45)),
        ],
        batch: newDefaultTestBatch(),
        accountSid,
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
        accountSid,
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
        accountSid,
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
        accountSid,
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
            ResourceReferenceStringAttributes: [
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
        accountSid,
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
      for (const [resourceId, expectedResource] of Object.entries(expectedResourceUpdates)) {
        const response = await request
          .get(`/v0/accounts/${accountSid}/resources/resource/${resourceId}`)
          .set(headers);
        expect(response.status).toBe(200);
        const resource = response.body as ReferrableResource;
        expect(resource).toStrictEqual(expectedResource);
      }
      await verifyImportState(expectedBatchProgressState);
    },
  );

  test('One malformed resource - rejects whole batch and returns 400', async () => {
    const { id, ...missingIdResource } = generateImportResource('3', baselineDate);
    const requestBody: ImportRequestBody = {
      importedResources: [
        generateImportResource('2', subSeconds(baselineDate, 15)),
        missingIdResource as ImportApiResource,
        generateImportResource('4', addSeconds(baselineDate, 15)),
      ],
      batch: newDefaultTestBatch(),
      accountSid,
    };
    const response = await internalRequest
      .post(route)
      .set(internalHeaders)
      .send(requestBody);
    expect(response.body).toStrictEqual({
      reason: 'missing field',
      fields: ['id'],
      resource: missingIdResource,
    });
    expect(response.status).toBe(400);
    for (let resourceIdx = 0; resourceIdx < 5; resourceIdx++) {
      const resourceId = `RESOURCE_${resourceIdx}`;
      await verifyGeneratedResourcesAttributes(resourceId);
    }
  });
});
