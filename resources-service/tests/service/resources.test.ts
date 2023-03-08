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
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { ReferrableResource } from '../../src/resource/resource-model';
import { ReferrableResourceAttribute } from '../../src/resource/resource-data-access';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

const range = (elements: number | string): string[] =>
  Array.from(Array(typeof elements === 'number' ? elements : parseInt(elements)).keys()).map(i =>
    i.toString(),
  );

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  const accountResourceIdTuples: [string, string[]][] = [
    ['1', range(5)],
    ['2', range(2)],
  ];
  const testResourceCreateSql = accountResourceIdTuples
    .flatMap(([accountIdx, resourceIdxs]) =>
      resourceIdxs.flatMap(resourceIdx => {
        const sql = `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'Resource ${resourceIdx} (Account ${accountIdx})')`;
        const attributeSql = range(parseInt(resourceIdx)).flatMap(attributeIdx =>
          range((parseInt(attributeIdx) % 2) + 1).map(
            valueIdx =>
              `INSERT INTO resources."ResourceStringAttributes" ("resourceId", "accountSid", "key", "language", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'ATTRIBUTE_${attributeIdx}', 'en-US', 'VALUE_${valueIdx}', '{ "some": "json" }')`,
          ),
        );
        return [sql, ...attributeSql];
      }),
    )
    .join(';\n');
  // console.log(testResourceCreateSql); // handy for debugging
  await db.multi(testResourceCreateSql);
});

/*
 * This function expects attributes to have been applied in a specific pattern (as defined in the beforeAll step):
 * - Each resource has a number of attributes equal to its index
 * - Even numbered attributes have 1 value, odd numbered attributes have 2 values
 * - Each value has the same info
 * - Each value has the same language
 */
const verifyResourcesAttributes = (resource: ReferrableResource) => {
  const [, resourceIdx] = resource.id.split('_');
  range(resourceIdx).forEach(attributeIdx => {
    const attribute = resource.attributes[`ATTRIBUTE_${attributeIdx}`];
    expect(attribute).toBeDefined();
    const expectedValues = (parseInt(attributeIdx) % 2) + 1;
    expect(attribute).toHaveLength(expectedValues);
    range(expectedValues).forEach(valueIdx => {
      expect(attribute[parseInt(valueIdx)]).toStrictEqual({
        info: { some: 'json' },
        language: 'en-US',
        value: `VALUE_${valueIdx}`,
      });
    });
  });
};

describe('GET /resource', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/resource';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  test('Should return a 200 response with a single resource object', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`).set(headers);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'RESOURCE_1',
      name: 'Resource 1 (Account 1)',
    });
    verifyResourcesAttributes(response.body);
  });

  describe('Reference Attributes', () => {
    beforeAll(async () => {
      const createReferenceSql = range(2)
        .flatMap(accountIndex =>
          range(10).flatMap(keyIndex =>
            range(keyIndex).flatMap(valueIndex =>
              range((parseInt(valueIndex) % 2) + 1).map(
                // alternate between 1 and 2  language values
                languageIndex =>
                  `INSERT INTO resources."ResourceReferenceStringAttributeValues" (id, "accountSid", "list", "value", "language", "info") 
                        VALUES (
                            'REF_${valueIndex}_${languageIndex}', 
                            'REFERENCES_TEST_ACCOUNT_${accountIndex}', 
                            'LIST_${keyIndex}',
                            'REFERENCE_VALUE_${valueIndex}', 
                            'LANGUAGE_${languageIndex}', 
                            ${
                              languageIndex === '1'
                                ? 'NULL'
                                : `'{ "property_${keyIndex}": "VALUE_${valueIndex}" }'`
                            })`,
              ),
            ),
          ),
        )
        .join(';\n');
      await db.multi(createReferenceSql);
    });
    beforeEach(async () => {
      await db.multi(
        range(2)
          .flatMap(accountIndex =>
            range(3).map(
              resourceIdx =>
                `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'REFERENCES_TEST_ACCOUNT_${accountIndex}', 'Resource ${resourceIdx}')`,
            ),
          )
          .join(';\n'),
      );
    });
    afterEach(async () => {
      await db.none(
        `DELETE FROM resources."Resources" WHERE "accountSid" ILIKE 'REFERENCES_TEST_ACCOUNT_%'`,
      );
    });
    each([
      {
        description: `Single referenced attribute value - returns referenced value`,
        setupSqlStatements: [
          `INSERT INTO resources."ResourceReferenceStringAttributes" 
            ("accountSid", "resourceId", "key", "list", "referenceId")
            VALUES ('REFERENCES_TEST_ACCOUNT_0','RESOURCE_0', 'REFERENCE_KEY_1', 'LIST_1', 'REF_0_0')`,
        ],
        nameSubstring: 'Resource 0',
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_1: [
              {
                value: 'REFERENCE_VALUE_0',
                language: 'LANGUAGE_0',
                info: {
                  property_1: 'VALUE_0',
                },
              },
            ],
          },
        },
      },
      {
        description: `Multiple referenced attribute values under same key - returns referenced values grouped under the key`,
        setupSqlStatements: range(3).map(
          valueIndex =>
            `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_7', 'LIST_7', 'REF_${valueIndex}_0')`,
        ),
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_7: range(3).map(valueIndex => ({
              value: `REFERENCE_VALUE_${valueIndex}`,
              language: 'LANGUAGE_0',
              info: {
                property_7: `VALUE_${valueIndex}`,
              },
            })),
          },
        },
      },
      {
        description: `Multiple referenced attribute values under same key and value but different languages - returns referenced values grouped under the key`,
        setupSqlStatements: range(2).map(
          languageIndex =>
            `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_5', 'LIST_5', 'REF_3_${languageIndex}')`,
        ),
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_5: range(2).map(languageIndex => ({
              value: 'REFERENCE_VALUE_3',
              language: `LANGUAGE_${languageIndex}`,
              info:
                languageIndex === '1'
                  ? null
                  : {
                      property_5: `VALUE_3`,
                    },
            })),
          },
        },
      },
      {
        description: `Multiple referenced attribute values under different keys - returns referenced values under their respective keys`,
        setupSqlStatements: range(3).map(
          keyIndex =>
            `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_${parseInt(
                  keyIndex,
                ) + 6}', 'LIST_${parseInt(keyIndex) + 6}', 'REF_5_0')`,
        ),
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: Object.fromEntries(
            range(3).map(keyIndex => [
              `REFERENCE_KEY_${parseInt(keyIndex) + 6}`,
              [
                {
                  value: 'REFERENCE_VALUE_5',
                  language: 'LANGUAGE_0',
                  info: {
                    [`property_${parseInt(keyIndex) + 6}`]: `VALUE_5`,
                  },
                },
              ],
            ]),
          ),
        },
      },
      {
        description: `Referenced attribute values and inline attributes under different keys - returns ALL values under their respective keys`,
        setupSqlStatements: [
          `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'LIST_6', 'REF_5_0')`,
          `INSERT INTO resources."ResourceStringAttributes" 
                ("accountSid", "resourceId", "key", "value", "language") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'INLINE_KEY', 'INLINE_VALUE', 'INLINE_LANGUAGE')`,
        ],
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_6: [
              {
                value: 'REFERENCE_VALUE_5',
                language: 'LANGUAGE_0',
                info: {
                  [`property_6`]: `VALUE_5`,
                },
              },
            ],
            INLINE_KEY: [
              {
                value: 'INLINE_VALUE',
                language: 'INLINE_LANGUAGE',
                info: null,
              },
            ],
          },
        },
      },
      {
        description: `Referenced attribute values and inline attributes under same keys - returns all values under the one key`,
        setupSqlStatements: [
          `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'LIST_6', 'REF_5_0')`,
          `INSERT INTO resources."ResourceStringAttributes" 
                ("accountSid", "resourceId", "key", "value", "language") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'INLINE_VALUE', 'LANGUAGE_0')`,
        ],
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_6: [
              {
                value: 'REFERENCE_VALUE_5',
                language: 'LANGUAGE_0',
                info: {
                  [`property_6`]: `VALUE_5`,
                },
              },
              {
                value: 'INLINE_VALUE',
                language: 'LANGUAGE_0',
                info: null,
              },
            ],
          },
        },
      },
      {
        description: `Referenced attribute values and inline attributes under same keys with same values but different languages - returns all values under the one key`,
        setupSqlStatements: [
          `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'LIST_6', 'REF_5_0')`,
          `INSERT INTO resources."ResourceStringAttributes" 
                ("accountSid", "resourceId", "key", "value", "language") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'REFERENCE_VALUE_5', 'INLINE_LANGUAGE')`,
        ],
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_6: [
              {
                value: 'REFERENCE_VALUE_5',
                language: 'LANGUAGE_0',
                info: {
                  [`property_6`]: `VALUE_5`,
                },
              },
              {
                value: 'REFERENCE_VALUE_5',
                language: 'INLINE_LANGUAGE',
                info: null,
              },
            ],
          },
        },
      },
      {
        description: `Referenced attribute values and inline attributes keys exist for same resource with same key value and language - returns both values`,
        setupSqlStatements: [
          `INSERT INTO resources."ResourceReferenceStringAttributes" 
                ("accountSid", "resourceId", "key", "list", "referenceId") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'LIST_6', 'REF_5_0')`,
          `INSERT INTO resources."ResourceStringAttributes" 
                ("accountSid", "resourceId", "key", "value", "language", "info") 
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_6', 'REFERENCE_VALUE_5', 'LANGUAGE_0', '{ "different": "info" }')`,
        ],
        expectedResult: {
          id: 'RESOURCE_0',
          name: 'Resource 0',
          attributes: {
            REFERENCE_KEY_6: [
              {
                value: 'REFERENCE_VALUE_5',
                language: 'LANGUAGE_0',
                info: {
                  [`property_6`]: `VALUE_5`,
                },
              },
              {
                value: 'REFERENCE_VALUE_5',
                language: 'LANGUAGE_0',
                info: { different: 'info' },
              },
            ],
          },
        },
      },
    ]).test(
      '$description',
      async ({
        setupSqlStatements,
        expectedResult,
      }: {
        setupSqlStatements: string[];
        nameSubstring: string;
        expectedResult: ReferrableResource;
      }) => {
        await db.multi(setupSqlStatements.join(';\n'));
        const response = await request
          .get(`/v0/accounts/REFERENCES_TEST_ACCOUNT_0/resources/resource/RESOURCE_0`)
          .set(headers);
        expect(response.status).toBe(200);
        const {
          attributes: responseAttributes,
          ...responseWithoutAttributes
        } = response.body as ReferrableResource;
        const { attributes: expectedAttributes, ...expectedWithoutAttributes } = expectedResult;
        expect(responseWithoutAttributes).toStrictEqual(expectedWithoutAttributes);
        const responseAttributeEntries = Object.entries(responseAttributes).sort(([keyA], [keyB]) =>
          keyA.localeCompare(keyB),
        );
        const expectedAttributeEntries = Object.entries(
          expectedAttributes as Record<string, ReferrableResourceAttribute[]>,
        ).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        expect(responseAttributeEntries).toHaveLength(expectedAttributeEntries.length);
        responseAttributeEntries.forEach(([key, value], index) => {
          const [expectedKey, expectedValue] = expectedAttributeEntries[index];
          expect(key).toBe(expectedKey);
          expect(value).toHaveLength(expectedValue.length);
          expect(value).toEqual(expect.arrayContaining(expectedValue));
        });
      },
    );
  });
});

describe('POST /search', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/search';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.post(`${basePath}?start=0&limit=5`).send({
      nameSubstring: 'Resource',
    });
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  each([
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '3',
      condition: 'a matching name substring, a limit and no ids',
      expectationDescription:
        'resources where their name contains the term, up to limit in ascending name order',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '3',
      start: '2',
      condition: 'a matching name substring, a limit and no ids, with an offset',
      expectationDescription:
        'resources where their name contains the term, up to limit in ascending name order',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '10',
      condition: 'a matching name substring, a limit larger than the result set no ids',
      expectationDescription: 'all resources where their name contains the term',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      start: '10',
      condition: 'a matching name substring, a start point past the end of the result set, no ids',
      expectationDescription: 'no resources but a correct totalCount',
      expectedResults: [],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource 3', ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1'] },
      limit: '10',
      condition: 'a matching name substring, and matching ids',
      expectationDescription:
        'all resources where their name contains the term and specified IDs, with specified IDs at the end',
      expectedResults: [
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 4,
    },
    {
      parameters: { nameSubstring: 'Resource 3', ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1'] },
      start: '2',
      condition: 'a matching name substring, and matching ids with offset in id range',
      expectationDescription: 'remaining ID resources',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 4,
    },
    {
      parameters: {
        nameSubstring: 'Resource 3',
        ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1', 'RESOURCE_4'],
      },
      start: '2',
      limit: '2',
      condition: 'a matching name substring, and matching ids with whole window in id range',
      expectationDescription: 'ID resources from correct position in list',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: {
        ids: ['RESOURCE_0', 'RESOURCE_2', 'NOT_A_RESOURCE', 'RESOURCE_1'],
      },
      limit: '10',
      condition: 'ids with missing ids',
      expectationDescription: 'only resources that match IDs are returned',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 3,
    },
    {
      parameters: {
        ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_0', 'RESOURCE_1', 'RESOURCE_2'],
      },
      limit: '10',
      condition: 'ids with duplicates',
      expectationDescription: 'only one resource per unique ID is returned',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 3,
    },
  ]).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({
      parameters: { nameSubstring, ids } = {},
      limit,
      start,
      expectedResults,
      expectedTotalCount,
    }: {
      parameters: {
        nameSubstring?: string;
        ids?: string[];
      };
      limit?: string;
      start?: string;
      expectedResults: ReferrableResource[];
      expectedTotalCount: number;
    }) => {
      let qs = Object.entries({ limit, start })
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const url = `${basePath}${qs.length ? '?' : ''}${qs}`;
      const response = await request
        .post(url)
        .set(headers)
        .send({
          nameSubstring,
          ids,
        });
      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(expectedTotalCount);
      expect(response.body.results).toHaveLength(expectedResults.length);
      expectedResults.forEach((expected, idx: number) => {
        const result = response.body.results[idx];
        expect(result).toMatchObject(expected);
        verifyResourcesAttributes(result);
      });
    },
  );

  describe('Found resource has referenced attributes', () => {
    beforeEach(async () => {
      await db.multi(`
INSERT INTO resources."ResourceReferenceStringAttributeValues" 
  (id, "accountSid", "list", "value", "language", "info") 
  VALUES (
      'REF_SEARCH_TEST_ATTRIBUTE', 
      'ACCOUNT_1', 
      'REFERENCE_LIST',
      'REFERENCE_VALUE', 
      'REFERENCE_LANGUAGE', 
      '{ "property": "VALUE" }');
INSERT INTO resources."ResourceReferenceStringAttributes" 
  ("accountSid", "resourceId", "key", "list", "referenceId") 
  VALUES ('ACCOUNT_1', 'RESOURCE_1', 'REFERENCE_KEY', 'REFERENCE_LIST', 'REF_SEARCH_TEST_ATTRIBUTE');
      `);
    });
    test('should return the resource with the referenced attributes', async () => {
      const response = await request
        .post(`${basePath}?limit=1&start=0`)
        .set(headers)
        .send({
          nameSubstring: 'Resource 1',
        });
      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(1);
      expect(response.body.results).toStrictEqual([
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {
            REFERENCE_KEY: [
              {
                value: 'REFERENCE_VALUE',
                language: 'REFERENCE_LANGUAGE',
                info: { property: 'VALUE' },
              },
            ],
            ATTRIBUTE_0: [
              {
                value: 'VALUE_0',
                language: 'en-US',
                info: { some: 'json' },
              },
            ],
          },
        },
      ]);
    });
    afterEach(async () => {
      await db.multi(`
DELETE FROM resources."ResourceReferenceStringAttributeValues"
WHERE id = 'REF_SEARCH_TEST_ATTRIBUTE';
DELETE FROM resources."ResourceReferenceStringAttributes";
      `);
    });
  });
});
