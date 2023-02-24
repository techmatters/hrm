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
  console.log(testResourceCreateSql); // handy for debugging
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
  console.log('RESOURCE: ', JSON.stringify(resource, null, 2));
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
    console.log(response.status);
    console.log(response.body);
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
          attributes: {},
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
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
          attributes: {},
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
          attributes: {},
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
          attributes: {},
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
      console.log('POST', url, {
        nameSubstring,
        ids,
      });
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
});
