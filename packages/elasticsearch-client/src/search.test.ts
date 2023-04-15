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
import * as search from './search';

describe('Search', () => {
  describe('getTotalValue', () => {
    test('when passed a number, should return the number', () => {
      expect(search.getTotalValue(10)).toBe(10);
    });

    test('when passed a SearchTotalHits object, should return the total property', () => {
      expect(search.getTotalValue({ value: 10, relation: 'eq' })).toBe(10);
    });
  });

  describe('generateFilters', () => {
    test('when passed an empty object, should return an empty array', () => {
      expect(search.generateFilters({})).toEqual([]);
    });

    test('when passed a filters object, should return an array of filters', () => {
      expect(search.generateFilters({ city: ['Toronto'] })).toEqual([
        {
          terms: {
            city: ['Toronto'],
          },
        },
      ]);
    });
  });

  describe('generateElasticsearchQuery', () => {
    type TestCaseParameters = {
      parameters: search.SearchGenerateElasticsearchQueryParams;
      condition: string;
      expectationDescription: string;
      expectedResults: search.SearchQuery;
    };

    const index = 'resources';
    const fields = ['title'];

    const testCases: TestCaseParameters[] = [
      {
        parameters: {
          index,
          searchParameters: {
            q: 'test',
          },
          fields,
        },
        condition: 'a searchParameters object with only a q parameter',
        expectationDescription: 'should return a SearchQuery object with only a query property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  query_string: {
                    fields,
                    query: 'test',
                  },
                },
              ],
            },
          },
        },
      },
      {
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              city: ['Toronto'],
            },
          },
          fields,
        },
        condition: 'a searchParameters object with a q and filters parameter',
        expectationDescription:
          'should return a SearchQuery object with a query and filter property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  query_string: {
                    fields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  terms: {
                    city: ['Toronto'],
                  },
                },
              ],
            },
          },
        },
      },
      {
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              city: ['Toronto'],
            },
            pagination: {
              limit: 10,
              start: 10,
            },
          },
          fields,
        },
        condition: 'a searchParameters object with a q, filters, and pagination parameter',
        expectationDescription:
          'should return a SearchQuery object with a query, filter, size, and from property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  query_string: {
                    fields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  terms: {
                    city: ['Toronto'],
                  },
                },
              ],
            },
          },
          size: 10,
          from: 10,
        },
      },
    ];

    each(testCases).test(
      'When passed a $condition, $expectationDescription',
      ({ parameters, expectedResults }) => {
        expect(search.generateElasticsearchQuery(parameters)).toEqual(expectedResults);
      },
    );
  });
});
