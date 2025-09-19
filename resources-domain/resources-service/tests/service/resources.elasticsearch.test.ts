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

import { ReferrableResource } from '@tech-matters/resources-types';

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { ReferrableResourceSearchResult } from '../../src/resource/resourceService';
import { AssertionError } from 'assert';
import { Client, getClient } from '@tech-matters/elasticsearch-client';
import { getById } from '../../src/resource/resourceDataAccess';
import {
  RESOURCE_INDEX_TYPE,
  resourceIndexConfiguration,
} from '@tech-matters/resources-search-config';
import range from './range';

export const workerSid = 'WK-worker-sid';

const indexType = RESOURCE_INDEX_TYPE;
const clients: Record<string, Client> = {};

const server = getServer();
const request = getRequest(server);

const accountSids = ['ACCOUNT_1', 'ACCOUNT_2'];

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

afterAll(async () => {
  await db.multi(`
      DELETE FROM resources."ResourceReferenceStringAttributeValues";
      DELETE FROM resources."Resources";
   `);
  await Promise.all(
    accountSids.map(async accountSid => {
      await clients[accountSid].indexClient(resourceIndexConfiguration).deleteIndex();
    }),
  );
});

beforeAll(async () => {
  await mockingProxy.start();

  const accountResourceIdTuples: [string, string[]][] = [
    ['1', range(5)],
    ['2', range(2)],
  ];
  let testResourceCreateSql = accountResourceIdTuples
    .flatMap(([accountIdx, resourceIdxs]) =>
      resourceIdxs.flatMap(resourceIdx => {
        const sql = `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'Resource ${resourceIdx} (Account ${accountIdx})')`;
        const attributeSql = range(parseInt(resourceIdx)).flatMap(attributeIdx =>
          range(parseInt(attributeIdx) + 1).map(
            valueIdx =>
              `INSERT INTO resources."ResourceStringAttributes" ("resourceId", "accountSid", "key", "language", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'ATTRIBUTE_${attributeIdx}', 'en-US', 'VALUE_${valueIdx}', '{ "some": "json" }')`,
          ),
        );
        const suggestSql = [
          `INSERT INTO resources."ResourceStringAttributes" ("resourceId", "accountSid", "key", "language", "value", "info") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'taxonomies/0/0', 'en-US', 'suggest_${resourceIdx}', '{ "some": "json" }')`,
        ];

        return [sql, ...attributeSql, ...suggestSql];
      }),
    )
    .join(';\n');

  // console.log(testResourceCreateSql); // handy for debugging
  await db.multi(testResourceCreateSql);

  await mockSuccessfulTwilioAuthentication(workerSid);

  await Promise.all(
    accountResourceIdTuples.flatMap(async ([accountIdx, resourceIdxs]) => {
      const accountSid = `ACCOUNT_${accountIdx}` as const;

      const client = await getClient({
        accountSid,
        config: {
          node: 'http://localhost:9200',
        },
        indexType,
      });
      clients[accountSid] = client;
      const indexClient = client.indexClient(resourceIndexConfiguration);
      await indexClient.createIndex({});

      await Promise.all(
        resourceIdxs.flatMap(async resourceIdx => {
          const dbResource = await getById(accountSid, `RESOURCE_${resourceIdx}`);

          if (!dbResource) {
            throw new Error(`Resource ${resourceIdx} not found`);
          }

          await indexClient.indexDocument({
            document: dbResource,
            id: dbResource.id,
          });
        }),
      );

      await indexClient.refreshIndex();
    }),
  );
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
    const expectedValues = parseInt(attributeIdx) + 1;
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

describe('GET /search', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/search';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request
      .post(`${basePath}?start=0&limit=5`)
      .send({ generalSearchTerm: '*' });
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  type TestCaseParameters = {
    generalSearchTerm: string;
    limit?: string;
    start?: string;
    condition: string;
    expectationDescription: string;
    expectedResults: ReferrableResourceSearchResult[];
    expectedTotalCount: number;
  };

  /**
   * Not that we don't test the term parsing here, since the endpoint is mocked anyway it's better to test that in the unit tests for the search client.
   */
  const testCases: TestCaseParameters[] = [
    {
      generalSearchTerm: 'VALUE_12',
      limit: '3',
      start: '0',
      condition: 'a term which matches nothing',
      expectationDescription: 'an empty result set with a totalCount of 0',
      expectedResults: [],
      expectedTotalCount: 0,
    },
    {
      generalSearchTerm: 'VALUE_0',
      limit: '3',
      start: '0',
      condition: 'a query which returns more records which match resources in the DB',
      expectationDescription:
        'a result set of all the resources matching the IDs returned by Elasticsearch and the correct total',
      expectedResults: [
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: expect.anything(),
        },
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
      expectedTotalCount: 4,
    },
    {
      generalSearchTerm: 'VALUE_1',
      limit: '3',
      start: '0',
      condition: 'a query which returns records which match resources in the DB',
      expectationDescription:
        'a result set of all the resources matching the IDs returned by Elasticsearch',
      expectedResults: [
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: expect.anything(),
        },
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
      expectedTotalCount: 3,
    },
    {
      generalSearchTerm: 'VALUE_2',
      limit: '3',
      start: '0',
      condition: 'a query which returns records which match resources in the DB',
      expectationDescription:
        'a result set of all the resources matching the IDs returned by Elasticsearch',
      expectedResults: [
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: expect.anything(),
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 2,
    },
    {
      generalSearchTerm: 'VALUE_3',
      limit: '3',
      start: '0',
      condition: 'a query which returns records which match resources in the DB',
      expectationDescription:
        'a result set of all the resources matching the IDs returned by Elasticsearch',
      expectedResults: [
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 1,
    },
    {
      generalSearchTerm: '"RESOURCE 2"',
      limit: '3',
      start: '0',
      condition: 'a query that matches a name phrase',
      expectationDescription: 'a result set that matches the name',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: expect.anything(),
        },
      ],
      expectedTotalCount: 1,
    },
    // Test this in unit tests since we are actually querying ES now?
    // {
    //   q: 'VALUE_1',
    //   limit: '3',
    //   start: '0',
    //   condition: 'a search that returns a record with an ID that does not exist in the DB',
    //   expectationDescription:
    //     'a result set excluding the missing record, smaller than the requested limit',
    //   expectedResults: [
    //     {
    //       id: 'RESOURCE_4',
    //       name: 'Resource 3 (Account 1)',
    //       attributes: expect.anything(),
    //     },
    //     {
    //       id: 'RESOURCE_3',
    //       name: 'Resource 2 (Account 1)',
    //       attributes: expect.anything(),
    //     },
    //   ],
    //   expectedTotalCount: 2,
    // },
  ];

  each(testCases).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({
      generalSearchTerm,
      limit,
      start,
      expectedResults,
      expectedTotalCount,
    }: TestCaseParameters) => {
      const response = await request
        .post(`${basePath}/?limit=${limit}&start=${start}`)
        .set(headers)
        .send({
          generalSearchTerm,
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
});

describe('GET /suggest', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/suggest';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(`${basePath}?size=5&prefix=sugg`).send();
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  test('Should return valid suggestions when authenticated', async () => {
    const response = await request
      .get(`${basePath}?size=5&prefix=sugg`)
      .set(headers)
      .send();

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('taxonomyLevelNameCompletion');
    expect(response.body.taxonomyLevelNameCompletion).toStrictEqual([
      {
        text: 'suggest_0',
        score: 1,
      },
      {
        text: 'suggest_1',
        score: 1,
      },
      {
        text: 'suggest_2',
        score: 1,
      },
      {
        text: 'suggest_3',
        score: 1,
      },
      {
        text: 'suggest_4',
        score: 1,
      },
    ]);
  });
});
