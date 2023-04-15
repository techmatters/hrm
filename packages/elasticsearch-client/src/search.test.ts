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
