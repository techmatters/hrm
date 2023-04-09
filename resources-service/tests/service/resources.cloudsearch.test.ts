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

import { ReferrableResource } from '@tech-matters/types';

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { ReferrableResourceSearchResult } from '../../src/resource/resource-model';
import { AssertionError } from 'assert';
import { SearchParameters } from '../../src/resource/search/search-types';
import { SearchResponse } from '@aws-sdk/client-cloudsearch-domain';
import addHours from 'date-fns/addHours';

export const workerSid = 'WK-worker-sid';

const server = getServer({
  cloudSearchConfig: {
    searchUrl: new URL('https://resources.mock-cloudsearch.com'),
  },
});
const request = getRequest(server);
let mockServer: Awaited<ReturnType<typeof mockingProxy.mockttpServer>>;

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

const range = (elements: number | string): string[] =>
  Array.from(Array(typeof elements === 'number' ? elements : parseInt(elements)).keys()).map(i =>
    i.toString(),
  );

beforeAll(async () => {
  await mockingProxy.start();
  mockServer = await mockingProxy.mockttpServer();
  const mockttp = await mockingProxy.mockttpServer();
  await mockttp
    .forGet(/https:\/\/resources\.mock-cloudsearch\.com\/2013-01-01\/search(.*)/)
    .thenReply(200, JSON.stringify({}));
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

beforeEach(async () => {
  (await mockingProxy.mockttpServer()).reset();
  await mockSuccessfulTwilioAuthentication(workerSid);
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

describe('POST /search', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/search';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.post(`${basePath}?start=0&limit=5`).send({
      nameSubstring: 'Resource',
    });
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  type TestCaseParameters = {
    parameters: Omit<SearchParameters, 'pagination'>;
    limit?: string;
    start?: string;
    condition: string;
    expectationDescription: string;
    expectedCloudSearchQuery: string;
    cloudSearchResponse: SearchResponse;
    expectedResults: ReferrableResourceSearchResult[];
    expectedTotalCount: number;
  };

  /**
   * Not that we don't test the term parsing here, since the endpoint is mocked anyway it's better to test that in the unit tests for the search client.
   */
  const testCases: TestCaseParameters[] = [
    {
      parameters: { generalSearchTerm: 'something' },
      limit: '3',
      condition: 'a term which matches nothing',
      expectationDescription: 'an empty result set with a totalCount of 0',
      cloudSearchResponse: {
        hits: {
          found: 0,
          hit: [],
        },
      },
      expectedCloudSearchQuery:
        "(or (term field='name' boost=3 'something')(term field='search_terms_en_1' boost=2 'something')(term field='search_terms_en_2' boost=1 'something'))",
      expectedResults: [],
      expectedTotalCount: 0,
    },
    {
      parameters: { generalSearchTerm: 'something' },
      limit: '3',
      start: '15',
      condition: 'a term which returns records which match resources in the DB',
      expectationDescription:
        'a result set of all the resources matching the IDs returned by CloudSearch',
      cloudSearchResponse: {
        hits: {
          found: 321,
          hit: [
            {
              id: 'RESOURCE_3',
              fields: {
                name: ['Resource 3 (Account 3)'],
                resource_id: ['RESOURCE_2'],
              },
            },
            {
              id: 'RESOURCE_1',
              fields: {
                name: ['Resource 1 (Account 1)'],
                resource_id: ['RESOURCE_1'],
              },
            },
            {
              id: 'RESOURCE_2',
              fields: {
                name: ['Resource 2 (Account 2)'],
                resource_id: ['RESOURCE_2'],
              },
            },
          ],
        },
      },
      expectedCloudSearchQuery:
        "(or (term field='name' boost=3 'something')(term field='search_terms_en_1' boost=2 'something')(term field='search_terms_en_2' boost=1 'something'))",
      expectedResults: [
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 321,
    },
    {
      parameters: { generalSearchTerm: 'something' },
      limit: '3',
      start: '15',
      condition: 'a search that returns a record where the name differs from the one in the DB',
      expectationDescription: 'a result set using names from the DB',
      cloudSearchResponse: {
        hits: {
          found: 321,
          hit: [
            {
              id: 'RESOURCE_3',
              fields: {
                name: ['Different name for resource 3'],
                resource_id: ['RESOURCE_3'],
              },
            },
            {
              id: 'RESOURCE_1',
              fields: {
                name: ['Different name for resource 1'],
                resource_id: ['RESOURCE_1'],
              },
            },
            {
              id: 'RESOURCE_2',
              fields: {
                name: ['Different name for resource 2'],
                resource_id: ['RESOURCE_3'],
              },
            },
          ],
        },
      },
      expectedCloudSearchQuery:
        "(or (term field='name' boost=3 'something')(term field='search_terms_en_1' boost=2 'something')(term field='search_terms_en_2' boost=1 'something'))",
      expectedResults: [
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 321,
    },
    {
      parameters: { generalSearchTerm: 'something' },
      limit: '3',
      start: '15',
      condition: 'a search that returns a record with an ID that does not exist in the DB',
      expectationDescription:
        'a result set excluding the missing record, smaller than the requested limit',
      cloudSearchResponse: {
        hits: {
          found: 321,
          hit: [
            {
              id: 'RESOURCE_3',
              fields: {
                name: ['Resource 3 (Account 1)'],
                resource_id: ['RESOURCE_3'],
              },
            },
            {
              id: 'NOT_IN_THE_DATABASE',
              fields: {
                name: ['Not in DB'],
                resource_id: ['NOT_IN_THE_DATABASE'],
              },
            },
            {
              id: 'RESOURCE_2',
              fields: {
                name: ['Resource 2 (Account 1)'],
                resource_id: ['RESOURCE_2'],
              },
            },
          ],
        },
      },
      expectedCloudSearchQuery:
        "(or (term field='name' boost=3 'something')(term field='search_terms_en_1' boost=2 'something')(term field='search_terms_en_2' boost=1 'something'))",
      expectedResults: [
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 321,
    },
  ];

  each(testCases).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({
      parameters,
      limit,
      start,
      expectedResults,
      expectedTotalCount,
      expectedCloudSearchQuery,
      cloudSearchResponse,
    }: TestCaseParameters) => {
      // Arrange
      const mockedEndpoint = await mockServer
        .forGet(/https:\/\/resources\.mock-cloudsearch\.com\/2013-01-01\/search(.*)/)
        .thenJson(200, cloudSearchResponse);
      let qs = Object.entries({ limit, start })
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const url = `${basePath}${qs.length ? '?' : ''}${qs}`;

      // Act
      const response = await request
        .post(url)
        .set(headers)
        .send(parameters);

      // Assert
      const path = decodeURIComponent((await mockedEndpoint.getSeenRequests())[0].path);
      expect(path).toContain(`q=${expectedCloudSearchQuery}`);
      expect(path).toContain(`size=${limit}`);
      expect(path).toContain(`start=${start ?? '0'}`);
      expect(path).toContain(`fq=account_sid:'ACCOUNT_1'`);
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

  describe('Inline attributes of non string types', () => {
    const dateVal = new Date(2010, 15, 11, 13, 30, 15);
    beforeEach(async () => {
      await db.multi(`
INSERT INTO resources."ResourceBooleanAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'BOOLEAN_ATTRIBUTE', true, '{ "some": "json" }');
INSERT INTO resources."ResourceNumberAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'NUMBER_ATTRIBUTE', 1337.42, '{ "some": "json" }');
INSERT INTO resources."ResourceDateTimeAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_1', 'ACCOUNT_1', 'DATETIME_ATTRIBUTE', '${dateVal.toISOString()}', '{ "some": "json" }');
INSERT INTO resources."ResourceBooleanAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_2', 'ACCOUNT_1', 'BOOLEAN_ATTRIBUTE', false, '{ "some": "json" }');
INSERT INTO resources."ResourceNumberAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_2', 'ACCOUNT_1', 'NUMBER_ATTRIBUTE', 666, '{ "some": "json" }');
INSERT INTO resources."ResourceDateTimeAttributes" ("resourceId", "accountSid", "key", "value", "info") VALUES ('RESOURCE_2', 'ACCOUNT_1', 'DATETIME_ATTRIBUTE', '${addHours(
        dateVal,
        2,
      ).toISOString()}', '{ "some": "json" }');
       `);
    });
    test('should return the resource with the attributes', async () => {
      // Arrange
      await mockServer
        .forGet(/https:\/\/resources\.mock-cloudsearch\.com\/2013-01-01\/search(.*)/)
        .thenJson(200, {
          hits: {
            found: 2,
            hit: [
              {
                id: 'RESOURCE_1',
                name: 'Resource 1 (Account 1)',
                attributes: expect.anything(),
              },
              {
                id: 'RESOURCE_2',
                name: 'Resource 2 (Account 1)',
                attributes: expect.anything(),
              },
            ],
          },
        });
      const url = `${basePath}?limit=5&start=0`;

      // Act
      const response = await request
        .post(url)
        .set(headers)
        .send({ generalSearchTerm: 'something' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(2);
      expect(response.body.results).toHaveLength(2);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        totalCount: 2,
        results: [
          {
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
          },
          {
            id: 'RESOURCE_2',
            name: 'Resource 2 (Account 1)',
            attributes: {
              BOOLEAN_ATTRIBUTE: [
                {
                  value: false,
                  info: { some: 'json' },
                },
              ],
              NUMBER_ATTRIBUTE: [
                {
                  value: 666,
                  info: { some: 'json' },
                },
              ],
              DATETIME_ATTRIBUTE: [
                {
                  value: addHours(dateVal, 2).toISOString(),
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
              ATTRIBUTE_1: [
                {
                  value: 'VALUE_0',
                  language: 'en-US',
                  info: { some: 'json' },
                },
                {
                  value: 'VALUE_1',
                  language: 'en-US',
                  info: { some: 'json' },
                },
              ],
            },
          },
        ],
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
