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
import { ReferrableResource, SearchParameters, SearchResults } from '@tech-matters/types';

import {
  createIndex,
  deleteIndex,
  indexDocument,
  refreshIndex,
  getClient,
  search,
} from '../../../src';

const accountSid = 'test-account-sid';
const indexType = 'resources';

const documents: ReferrableResource[] = [
  {
    name: 'Carleton Victoria Community Vocational Board - Employment Assistance Agency',
    id: 'carleton-toronto',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value: 'Carleton Victoria Community Vocational Board - Employment Assistance description',
          language: 'en',
        },
        {
          value: `Carleton Victoria Community Vocational Board - Description de l'aide à l'emploi`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 10 }],
      eligibilityMaxAge: [{ value: 20 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'Toronto' }],
    },
  },

  {
    name: 'Calgary Family Services - Child/Youth/Family Counselling at Calgary Family Services',
    id: 'calgary-london',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value:
            'Calgary Family Services - Child/Youth/Family Counselling at Calgary Family Services description',
          language: 'en',
        },
        {
          value: `Calgary Family Services - Counseling pour enfants/jeunes/familles à Calgary Family Services description`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 3 }],
      eligibilityMaxAge: [{ value: 5 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }, { value: 'keyword3' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'London' }],
    },
  },

  {
    name: 'Calgary Family Services - Child/Youth/Family Counselling at Calgary Family Services',
    id: 'calgary-toronto',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value:
            'Calgary Family Services - Child/Youth/Family Counselling at Calgary Family Services description',
          language: 'en',
        },
        {
          value: `Calgary Family Services - Counseling pour enfants/jeunes/familles à Calgary Family Services description`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 3 }],
      eligibilityMaxAge: [{ value: 5 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }, { value: 'keyword3' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'Toronto' }],
    },
  },
];

afterAll(async () => {
  await deleteIndex({ accountSid, indexType });
});

beforeAll(async () => {
  await getClient({
    accountSid,
    indexType,
    config: {
      node: 'http://localhost:9200',
    },
  });
  await createIndex({ accountSid, indexType });

  await Promise.all(
    documents.map(document => indexDocument({ accountSid, indexType, id: document.id, document })),
  );

  await refreshIndex({ accountSid, indexType });
});

describe('Resources Default Search', () => {
  type TestCaseParameters = {
    searchParameters: SearchParameters;
    condition: string;
    expectationDescription: string;
    expectedResults: SearchResults;
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
            id: 'carleton-toronto',
            highlights: undefined,
          },
          {
            id: 'calgary-toronto',
            highlights: undefined,
          },
          {
            id: 'calgary-london',
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
      condition: 'wildcard search query',
      expectationDescription: 'should return all resources',
      expectedResults: {
        total: 2,
        items: [
          {
            id: 'carleton-toronto',
            highlights: undefined,
          },
          {
            id: 'calgary-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: 'Carleton',
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'wildcard search query',
      expectationDescription: 'should return all resources',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'carleton-toronto',
            highlights: undefined,
          },
        ],
      },
    },

    {
      searchParameters: {
        q: 'calgary',
        filters: {
          city: ['Toronto'],
        },
        pagination: {
          start: 0,
          limit: 10,
        },
      },
      condition: 'wildcard search query',
      expectationDescription: 'should return all resources',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'calgary-toronto',
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
      condition: 'wildcard search query',
      expectationDescription: 'should return all resources',
      expectedResults: {
        total: 1,
        items: [
          {
            id: 'carleton-toronto',
            highlights: undefined,
          },
        ],
      },
    },
  ];

  each(testCases).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({ searchParameters, expectedResults }) => {
      const results = await search({ accountSid, indexType, searchParameters });

      expect(results.total).toEqual(expectedResults.total);
      expect(orderBy(results.items, 'id')).toEqual(orderBy(expectedResults.items, 'id'));
    },
  );
});
