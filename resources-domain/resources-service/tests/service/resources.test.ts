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

import {
  ReferrableResource,
  ReferrableResourceAttribute,
} from '@tech-matters/resources-types';

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { AssertionError } from 'assert';
import range from './range';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

afterAll(async () => {
  await db.multi(`
DELETE FROM resources."ResourceReferenceStringAttributeValues";
DELETE FROM resources."Resources"
      `);
});

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
    .concat(
      `INSERT INTO resources."Resources" (id, "accountSid", "name", "deletedAt") VALUES ('DELETED_RESOURCE', 'ACCOUNT_1', 'Deleted Resource (Account 1)', NOW())`,
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
    if (Array.isArray(attribute)) {
      expect(attribute).toHaveLength(expectedValues);
      range(expectedValues).forEach(valueIdx => {
        expect(attribute[parseInt(valueIdx)]).toStrictEqual({
          info: { some: 'json' },
          language: 'en-US',
          value: `VALUE_${valueIdx}`,
        });
      });
    } else {
      throw new AssertionError({ message: 'Expected attribute value to be an array' });
    }
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

  test('Should return a 404 response for a resource ID that has no associated resource', async () => {
    await request.get(`${basePath}/RESOURCE_DOESNT_EXIST`).set(headers).expect(404);
  });

  test('Should return a 404 response for a resource ID that is associated with a deleted resource', async () => {
    await request.get(`${basePath}/DELETED_RESOURCE`).set(headers).expect(404);
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
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE_KEY_${
                  parseInt(keyIndex) + 6
                }', 'LIST_${parseInt(keyIndex) + 6}', 'REF_5_0')`,
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
        const { attributes: responseAttributes, ...responseWithoutAttributes } =
          response.body as ReferrableResource;
        const { attributes: expectedAttributes, ...expectedWithoutAttributes } =
          expectedResult;
        expect(responseWithoutAttributes).toStrictEqual(expectedWithoutAttributes);
        const responseAttributeEntries = Object.entries(responseAttributes).sort(
          ([keyA], [keyB]) => keyA.localeCompare(keyB),
        );
        const expectedAttributeEntries = Object.entries(
          expectedAttributes as Record<string, ReferrableResourceAttribute<unknown>[]>,
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
    test('Referenced attribute slash separated key paths are returned as nested objects', async () => {
      await db.none(`INSERT INTO resources."ResourceReferenceStringAttributes"
                ("accountSid", "resourceId", "key", "list", "referenceId")
                VALUES ('REFERENCES_TEST_ACCOUNT_0', 'RESOURCE_0', 'REFERENCE/KEY/6', 'LIST_6', 'REF_5_0')`);
      const response = await request
        .get(`/v0/accounts/REFERENCES_TEST_ACCOUNT_0/resources/resource/RESOURCE_0`)
        .set(headers);
      expect(response.status).toBe(200);
      const expectedResult = {
        id: 'RESOURCE_0',
        name: 'Resource 0',
        attributes: {
          REFERENCE: {
            KEY: {
              6: [
                {
                  value: 'REFERENCE_VALUE_5',
                  language: 'LANGUAGE_0',
                  info: {
                    [`property_6`]: `VALUE_5`,
                  },
                },
              ],
            },
          },
        },
      };
      expect(response.body).toStrictEqual(expectedResult);
    });
  });

  describe('Inline attributes of non string types', () => {
    const dateVal = new Date(2010, 15, 11, 13, 30, 15);
    beforeEach(async () => {
      await db.multi(`
INSERT INTO resources."ResourceBooleanAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'BOOLEAN_ATTRIBUTE', true, '{ "some": "json" }');
INSERT INTO resources."ResourceNumberAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'NUMBER_ATTRIBUTE', 1337.42, '{ "some": "json" }');
INSERT INTO resources."ResourceDateTimeAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'DATETIME_ATTRIBUTE', '${dateVal.toISOString()}', '{ "some": "json" }');
       `);
    });
    test('should return the resource with the attributes', async () => {
      const response = await request.get(`${basePath}/RESOURCE_1`).set(headers);
      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        id: 'RESOURCE_1',
        name: 'Resource 1 (Account 1)',
        attributes: {
          BOOLEAN_ATTRIBUTE: [
            {
              value: true,
              info: { some: 'json' },
            },
          ],
          NUMBER_ATTRIBUTE: [
            {
              value: 1337.42,
              info: { some: 'json' },
            },
          ],
          DATETIME_ATTRIBUTE: [
            {
              value: dateVal.toISOString(),
              info: { some: 'json' },
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
      });
    });
    afterEach(async () => {
      await db.multi(`
DELETE FROM resources."ResourceBooleanAttributes";
DELETE FROM resources."ResourceNumberAttributes";
DELETE FROM resources."ResourceDateTimeAttributes";
      `);
    });
  });
});
