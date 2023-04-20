import { getInternalServer, getRequest, getServer, headers } from './server';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { db } from '../../src/connection-pool';
import range from './range';
import { parseISO, addHours, subHours } from 'date-fns';
import { ImportRequestBody } from '../../src/import/importRoutesV0';
import { ImportApiResource, ImportProgress } from '../../src/import/importTypes';
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

const populateSampleDbResources = async (count: number) => {
  const accountResourceIdTuples: [string, string[]][] = [['0', range(count)]];
  const testResourceCreateSql = accountResourceIdTuples
    .flatMap(([accountIdx, resourceIdxs]) =>
      resourceIdxs.flatMap(resourceIdx => {
        const sql = `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'Resource ${resourceIdx} (Account AC00${accountIdx})')`;
        const attributeSql = range(parseInt(resourceIdx)).flatMap(attributeIdx =>
          range((parseInt(attributeIdx) % 2) + 1).flatMap(valueIdx => [
            `INSERT INTO resources."ResourceStringAttributes" ("resourceId", "accountSid", "key", "language", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'ATTRIBUTE_${attributeIdx}', 'en-US', 'VALUE_${valueIdx}', '{ "some": "json" }')`,
            `INSERT INTO resources."ResourceDateTimeAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'DATETIME_ATTRIBUTE_${attributeIdx}', '${addHours(
              baselineDate,
              parseInt(valueIdx),
            ).toISOString()}', '{ "datetime": "json" }')`,
            `INSERT INTO resources."ResourceNumberAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'NUMBER_ATTRIBUTE_${attributeIdx}', ${valueIdx}, '{ "number": "json" }')`,
            parseInt(valueIdx) < 2
              ? `INSERT INTO resources."ResourceBooleanAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'BOOL_ATTRIBUTE_${attributeIdx}', '${Boolean(
                  parseInt(valueIdx) % 2,
                )}', '{ "bool": "json" }')`
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
        expect(attribute[parseInt(valueIdx)]).toStrictEqual({
          info: { some: 'json' },
          language: 'en-US',
          value: expectedValue(valueIdx),
        });
      });
    } else {
      throw new AssertionError({ message: 'Expected attribute value to be an array' });
    }
  });
};

const verifyGeneratedResourcesAttributes = async (resourceId: string) => {
  const response = await request
    .get(`/v0/accounts/ACCOUNT_1/resources/resource/${resourceId}`)
    .set(headers);
  expect(response.status).toBe(200);
  const resource = response.body as ReferrableResource;
  verifyGeneratedResourcesAttributesByType(resource, valueIdx => `VALUE_${valueIdx}`);
  verifyGeneratedResourcesAttributesByType(
    resource,
    valueIdx => addHours(baselineDate, parseInt(valueIdx)).toISOString(),
    'DATETIME_',
  );
  verifyGeneratedResourcesAttributesByType(
    resource,
    valueIdx => Boolean(parseInt(valueIdx) % 2),
    'BOOL_',
    2,
  );
  verifyGeneratedResourcesAttributesByType(resource, valueIdx => parseInt(valueIdx), 'NUMBER_');
};

const generateImportResource = (resourceIdSuffix: string, updatedAt: Date): ImportApiResource => ({
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
    ],
    ResourceDateTimeAttributes: [
      {
        key: 'DATETIME_ATTRIBUTE',
        value: baselineDate.toISOString(),
        info: { some: 'json' },
      },
    ],
    ResourceNumberAttributes: [
      {
        key: 'NUMBER_ATTRIBUTE',
        value: 1337,
        info: { some: 'json' },
      },
    ],
    ResourceBooleanAttributes: [
      {
        key: 'BOOL_ATTRIBUTE',
        value: true,
        info: { some: 'json' },
      },
    ],
    ResourceReferenceStringAttributes: [],
  },
});

const verifyImportState = async (expectedImportState?: ImportProgress) => {
  const result = await db.oneOrNone<{ ImportState: ImportProgress }>(
    `SELECT "importState" FROM resources."Accounts" WHERE "accountSid" = $<accountSid>`,
    { accountSid },
  );
  if (expectedImportState) {
    await expect(result).toStrictEqual({ ImportState: expectedImportState });
  } else {
    await expect(result).not.toBeDefined();
  }
};

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => Promise.all([mockingProxy.stop(), server.close()]));

beforeEach(async () => {
  await db.multi(`
    DELETE FROM resources."Accounts";
    DELETE FROM resources."Resources";
      `);
  await populateSampleDbResources(10);
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
    };
    internalRequest
      .post(route)
      .set({ ...internalHeaders, Authorization: `Basic C64` })
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
      },
      expectedResponse: [],
      expectedResourceUpdates: {},
    },
  ];

  each([testCases]).test(
    '$description',
    async ({
      requestBody,
      expectedResponse,
      expectedResourceUpdates,
      expectedBatchProgressState,
    }: ImportPostTestCaseParameters) => {
      jest.setTimeout(30000);
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
          .get(`/v0/accounts/ACCOUNT_1/resources/resource/${resourceId}`)
          .set(headers);
        expect(response.status).toBe(200);
        const resource = response.body as ReferrableResource;
        expect(resource).toStrictEqual(expectedResource);
      }
      verifyImportState(expectedBatchProgressState);
    },
  );
});
