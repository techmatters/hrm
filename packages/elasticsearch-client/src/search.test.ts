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
import { SearchConfiguration } from './config';

describe('Search', () => {
  describe('getTotalValue', () => {
    test('when passed a number, should return the number', () => {
      expect(search.getTotalValue(10)).toBe(10);
    });

    test('when passed a SearchTotalHits object, should return the total property', () => {
      expect(search.getTotalValue({ value: 10, relation: 'eq' })).toBe(10);
    });
  });

  describe('generateElasticsearchQuery', () => {
    type TestCaseParameters = {
      config: SearchConfiguration;
      parameters: search.SearchGenerateElasticsearchQueryParams;
      condition: string;
      expectationDescription: string;
      expectedResults: search.SearchQuery;
    };

    const index = 'resources';
    const searchFieldBoosts = {
      title: 1,
    };
    const expectedFields = ['title^1'];

    const testCases: TestCaseParameters[] = [
      {
        config: {
          searchFieldBoosts,
          filterMappings: {},
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
          },
        },
        condition: 'a searchParameters object with only a q parameter',
        expectationDescription: 'should return a SearchQuery object with only a query property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {},
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              city: ['Toronto'],
            },
          },
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
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
                {
                  multi_match: {
                    fields: ['title^2'],
                    query: 'Toronto',
                    type: 'cross_fields',
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {},
        },
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
        },
        condition:
          'a searchParameters object with a q, unmapped string filters, and pagination parameter',
        expectationDescription:
          'should return a SearchQuery object with a general search query, a boosted query for filter terms, size, and from property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
                {
                  multi_match: {
                    fields: ['title^2'],
                    query: 'Toronto',
                    type: 'cross_fields',
                  },
                },
              ],
              /*filter: [
                {
                  terms: {
                    city: ['Toronto'],
                  },
                },
              ]*/
            },
          },
          size: 10,
          from: 10,
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {},
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              city: ['Toronto', 'Vancouver'],
            },
          },
        },
        condition:
          'a searchParameters object with a q an unmapped filters parameter with an array value',
        expectationDescription:
          'should return a SearchQuery object with a general query and a boosted filter query property',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
                {
                  multi_match: {
                    fields: ['title^2'],
                    query: 'Toronto Vancouver',
                    type: 'cross_fields',
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {},
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              code: 1234,
            },
          },
        },
        condition:
          'a searchParameters object with a q an unmapped filter parameter with an number value',
        expectationDescription:
          'should return a SearchQuery object with a general query and a term filter',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  term: {
                    code: 1234,
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {
            minAge: {
              type: 'range',
              operator: 'gte',
              targetField: 'maxAge',
            },
            maxAge: {
              type: 'range',
              operator: 'lte',
              targetField: 'minAge',
            },
          },
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              minAge: 10,
              maxAge: 20,
            },
          },
        },
        condition: 'a searchParameters object with a q and a mapped range filter parameters',
        expectationDescription:
          'should return a SearchQuery object with a general query and a range filter',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  range: {
                    maxAge: {
                      gte: 10,
                    },
                  },
                },
                {
                  range: {
                    minAge: {
                      lte: 20,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {
            cities: {
              type: 'term',
              targetField: 'canadian_cities',
            },
          },
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              cities: ['Toronto', 'Vancouver'],
            },
          },
        },
        condition:
          'a searchParameters object with a q and mapped term filter parameter with an array value',
        expectationDescription:
          'should return a SearchQuery object with a general query and terms filter',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  terms: {
                    canadian_cities: ['Toronto', 'Vancouver'],
                  },
                },
              ],
            },
          },
        },
      },
      {
        config: {
          searchFieldBoosts,
          filterMappings: {
            city: {
              type: 'term',
              targetField: 'canadian_city',
            },
          },
        },
        parameters: {
          index,
          searchParameters: {
            q: 'test',
            filters: {
              city: 'Toronto',
            },
          },
        },
        condition:
          'a searchParameters object with a q and mapped term filter parameter with a single value',
        expectationDescription:
          'should return a SearchQuery object with a general query and term filter',
        expectedResults: {
          index,
          query: {
            bool: {
              must: [
                {
                  simple_query_string: {
                    fields: expectedFields,
                    query: 'test',
                  },
                },
              ],
              filter: [
                {
                  term: {
                    canadian_city: 'Toronto',
                  },
                },
              ],
            },
          },
        },
      },
    ];

    each(testCases).test(
      'When passed a $condition, $expectationDescription',
      ({ config, parameters, expectedResults }) => {
        expect(search.generateElasticsearchQuery(config, parameters)).toEqual(expectedResults);
      },
    );
  });
});
