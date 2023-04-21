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

import each from 'jest-each';
import { orderBy } from 'lodash';

import { getClient, IndexTypes } from '../../../src';
import { SearchParameters, SearchResponse, Client } from '../../../';
import { resourceDocuments } from '../../fixtures/resources';

const accountSid = 'test-account-sid';
const indexType = IndexTypes.RESOURCES;
let client: Client;

afterAll(async () => {
  await client.deleteIndex();
});

beforeAll(async () => {
  client = await getClient({
    accountSid,
    indexType,
    config: {
      node: 'http://localhost:9200',
    },
  });

  await client.createIndex({});

  await Promise.all(
    resourceDocuments.map(document => client.indexDocument({ id: document.id, document })),
  );

  await client.refreshIndex();
});

describe('Resources Default Search', () => {
  type TestCaseParameters = {
    searchParameters: SearchParameters;
    condition: string;
    expectationDescription: string;
    expectedResults: SearchResponse;
  };

  const testCases: TestCaseParameters[] = [
    {
      searchParameters: {
        q: '*',
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'wildcard search query',
      expectationDescription: 'should return all resources',
      expectedResults: {
        total: 3,
        items: [
          {
            id: 'employment-toronto',
            highlights: undefined,
          },
          {
            id: 'counselling-toronto',
            highlights: undefined,
          },
          {
            id: 'counselling-london',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: '*',
        filters: {
          city: ['Toronto'],
        },
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'wildcard search query with filtered by city: Toronto',
      expectationDescription: 'should return all resources in city Toronto',
      expectedResults: {
        total: 2,
        items: [
          {
            id: 'employment-toronto',
            highlights: undefined,
          },
          {
            id: 'counselling-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: 'employment',
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'employment search query',
      expectationDescription: 'should return only resources that match employment',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'employment-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: 'counselling',
        filters: {
          city: ['Toronto'],
        },
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'counselling search query with filter by city: Toronto',
      expectationDescription:
        'should return only resources that match counselling and are in Toronto',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'counselling-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: `l'aide`,
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'search query in french',
      expectationDescription: 'should return only resources that match french query',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'employment-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: `youth`,
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'search query only in name',
      expectationDescription: 'should return only resources that match query in the name',
      expectedResults: {
        total: 2,
        items: [
          {
            id: 'counselling-toronto',
            highlights: undefined,
          },
          {
            id: 'counselling-london',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: `"Family Counselling"`,
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'search query phrase',
      expectationDescription: 'should return only resources that match phrase query exactly',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'counselling-london',
            highlights: undefined,
          },
        ],
      },
    },
  ];

  each(testCases).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({ searchParameters, expectedResults }) => {
      const results = await client.search({ searchParameters });

      expect(results.total).toEqual(expectedResults.total);
      expect(orderBy(results.items, 'id')).toEqual(orderBy(expectedResults.items, 'id'));
    },
  );
});
