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
  getByIdList,
  getWhereNameContains,
  ReferrableResourceRecord,
} from '../../../src/resource/resourceDataAccess';
import {
  ReferrableResourceSearchResult,
  resourceService,
} from '../../../src/resource/resourceService';
import searchClient, {
  SearchResultSet,
} from '../../../src/resource/search/resource-cloudsearch-client';
import each from 'jest-each';
import { mapSearchParametersToKhpTermsAndFilters } from '../../../src/resource/search/khp-resource-search-mapping';
import { SearchParameters, TermsAndFilters } from '../../../src/resource/search/search-types';
import { BLANK_ATTRIBUTES } from '../mockResources';

jest.mock('../../../src/resource/resourceDataAccess', () => ({
  getByIdList: jest.fn(),
  getWhereNameContains: jest.fn(),
}));

jest.mock('../../../src/resource/search/resource-cloudsearch-client');

jest.mock('../../../src/resource/search/khp-resource-search-mapping');

const mockGetByIdList = getByIdList as jest.Mock<Promise<ReferrableResourceRecord[]>>;
const mockGetWhereNameContains = getWhereNameContains as jest.Mock<
  Promise<{ totalCount: number; results: string[] }>
>;

const mockSearchClientSearch = jest.fn() as jest.Mock<
  ReturnType<ReturnType<typeof searchClient>['search']>
>;
const mockSearchClient = searchClient as jest.Mock<ReturnType<typeof searchClient>>;

mockSearchClient.mockReturnValue({
  search: mockSearchClientSearch,
});

const { searchResourcesByName, searchResources } = resourceService({
  searchUrl: new URL('http://a.com'),
});

const BASELINE_DATE = new Date('2021-01-01T00:00:00.000Z');

const generateResourceRecord = (identifier: string): ReferrableResourceRecord => ({
  id: `RESOURCE_${identifier}`,
  name: `Resource ${identifier}`,
  lastUpdated: BASELINE_DATE.toISOString(),
  ...BLANK_ATTRIBUTES,
});

describe('searchResourcesByName', () => {
  beforeEach(() => {
    mockGetByIdList.mockReset();
    mockGetWhereNameContains.mockReset();
  });
  test('Name search only specified - finds ids with getWhereNameContains and looks up resources with getByIdList', async () => {
    const resultSet = [
      {
        ...generateResourceRecord('1'),
        stringAttributes: [
          { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
        ],
      },
      generateResourceRecord('2'),
    ];
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 123,
      results: ['RESOURCE_1', 'RESOURCE_2'],
    });
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: [],
      pagination: { limit: 5, start: 10 },
    });
    expect(res.totalCount).toBe(123);
    expect(res.results).toStrictEqual(
      resultSet.map(r => ({
        id: r.id,
        name: r.name,
        attributes: {
          ...(r.id === 'RESOURCE_1'
            ? { testAttribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }] }
            : {}),
        },
      })),
    );
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 10, 5);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', ['RESOURCE_1', 'RESOURCE_2']);
  });
  test('Limit over 200 - forces limit to 100', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 123,
      results: ['RESOURCE_1', 'RESOURCE_2'],
    });
    mockGetByIdList.mockResolvedValue([]);
    await searchResourcesByName('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: [],
      pagination: { limit: 500, start: 10 },
    });
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 10, 200);
  });
  test('Id search only specified - looks up resources with getByIdList', async () => {
    const resultSet = [generateResourceRecord('1'), generateResourceRecord('2')];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_1', 'RESOURCE_2'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(2);
    expect(res.results).toStrictEqual(
      resultSet.map(r => ({
        id: r.id,
        name: r.name,
        attributes: {},
      })),
    );
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', ['RESOURCE_1', 'RESOURCE_2']);
  });
  test('Id search only specified with start - skips {start} number of results', async () => {
    const resultSet = [
      generateResourceRecord('3'),
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 2 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual(
      resultSet.slice(2).map(r => ({ id: r.id, name: r.name, attributes: {} })),
    );
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search where DB returns different order - restores original order', async () => {
    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('3'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_3', name: 'Resource 3', attributes: {} },
      { id: 'RESOURCE_1', name: 'Resource 1', attributes: {} },
      { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
      { id: 'RESOURCE_4', name: 'Resource 4', attributes: {} },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search where DB doesnt find all IDs - returns what it finds, respecting original order', async () => {
    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(3);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1', attributes: {} },
      { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
      { id: 'RESOURCE_4', name: 'Resource 4', attributes: {} },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search with duplicates - restores order where each unique ID is first found', async () => {
    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('3'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: [
        'RESOURCE_3',
        'RESOURCE_3',
        'RESOURCE_3',
        'RESOURCE_1',
        'RESOURCE_3',
        'RESOURCE_1',
        'RESOURCE_2',
        'RESOURCE_4',
        'RESOURCE_2',
      ],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_3', name: 'Resource 3', attributes: {} },
      { id: 'RESOURCE_1', name: 'Resource 1', attributes: {} },
      { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
      { id: 'RESOURCE_4', name: 'Resource 4', attributes: {} },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_3',
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
      'RESOURCE_2',
    ]);
  });
  test('Id search where start is past max available results - returns empty array but correct result', async () => {
    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('3'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 3, start: 10 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Name and Id search - returns name results first', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 2,
      results: ['RESOURCE_1', 'RESOURCE_4'],
    });

    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('3'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: ['RESOURCE_3', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 10, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1', attributes: {} },
      { id: 'RESOURCE_4', name: 'Resource 4', attributes: {} },
      { id: 'RESOURCE_3', name: 'Resource 3', attributes: {} },
      { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
    ]);
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 0, 10);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_1',
      'RESOURCE_4',
      'RESOURCE_3',
      'RESOURCE_2',
    ]);
  });
  test('Name and Id search from start greater than zero - calculates correct totalCount including ID list', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 100,
      results: ['RESOURCE_1', 'RESOURCE_4'],
    });

    const resultSet = [
      generateResourceRecord('1'),
      generateResourceRecord('2'),
      generateResourceRecord('3'),
      generateResourceRecord('4'),
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResourcesByName('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: ['RESOURCE_3', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 10, start: 98 },
    });
    expect(res.totalCount).toBe(102);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1', attributes: {} },
      { id: 'RESOURCE_4', name: 'Resource 4', attributes: {} },
      { id: 'RESOURCE_3', name: 'Resource 3', attributes: {} },
      { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
    ]);
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 98, 10);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_1',
      'RESOURCE_4',
      'RESOURCE_3',
      'RESOURCE_2',
    ]);
  });
});

const mockMapSearchParametersToKhpTermsAndFilters = mapSearchParametersToKhpTermsAndFilters as jest.Mock<
  TermsAndFilters
>;

const EMPTY_SEARCH_TERMS: TermsAndFilters = {
  filters: {},
  searchTermsByIndex: {},
};

describe('searchResources', () => {
  beforeEach(() => {
    mockGetByIdList.mockReset();
    mockSearchClientSearch.mockReset();
    mockSearchClient.mockReturnValue({
      search: mockSearchClientSearch,
    });
    mockMapSearchParametersToKhpTermsAndFilters.mockReset();
    mockMapSearchParametersToKhpTermsAndFilters.mockReturnValue(EMPTY_SEARCH_TERMS);
  });

  const baselineResultSet: ReferrableResourceRecord[] = [
    {
      ...generateResourceRecord('1'),
      stringAttributes: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
      ],
    },
    generateResourceRecord('2'),
  ];

  type SearchResourcesTestCaseParameters = {
    description: string;
    input: SearchParameters;
    resultsFromCloudSearch: SearchResultSet;
    resultsFromDb: ReferrableResourceRecord[];
    expectedSearchLimit?: number; // Would normally be limit provided in user input, except for some special cases
    expectedTotal: number;
    expectedResults?: ReferrableResourceSearchResult[]; // Would normally be results from DB, except for some special cases
  };
  const searchResourcesTestCases: SearchResourcesTestCaseParameters[] = [
    {
      description:
        'General Search Term and no filters provided - converts parameters, calls cloudsearch client, looks up the returned IDs in the DB and returns the result',
      input: {
        generalSearchTerm: 'Res',
        pagination: { limit: 5, start: 10 },
      },
      resultsFromCloudSearch: {
        total: 123,
        items: [
          { id: 'RESOURCE_1', name: 'Resource 1', highlights: {} },
          { id: 'RESOURCE_2', name: 'Resource 2', highlights: {} },
        ],
      },
      expectedTotal: 123,
      resultsFromDb: baselineResultSet,
    },
    {
      description: 'Limit set higher than 200 - limit set to 200',
      input: {
        generalSearchTerm: 'Res',
        pagination: { limit: 500, start: 10 },
      },
      resultsFromCloudSearch: {
        total: 1230,
        items: [
          { id: 'RESOURCE_1', name: 'Resource 1', highlights: {} },
          { id: 'RESOURCE_2', name: 'Resource 2', highlights: {} },
        ],
      },
      expectedSearchLimit: 200,
      expectedTotal: 1230,
      resultsFromDb: baselineResultSet,
    },
    {
      description:
        'Results from DB are in a different order to the results from CloudSearch - results are sorted by CloudSearch order',
      input: {
        generalSearchTerm: 'Res',
        pagination: { limit: 500, start: 10 },
      },
      resultsFromCloudSearch: {
        total: 1230,
        items: [
          { id: 'RESOURCE_2', name: 'Resource 2', highlights: {} },
          { id: 'RESOURCE_1', name: 'Resource 1', highlights: {} },
        ],
      },
      expectedSearchLimit: 200,
      expectedTotal: 1230,
      resultsFromDb: baselineResultSet,
      expectedResults: [
        { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1',
          attributes: {
            testAttribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      ],
    },
    {
      description:
        'CloudSearch returns IDs that are not in the DB - results are filtered to only include IDs in the DB',
      input: {
        generalSearchTerm: 'Res',
        pagination: { limit: 500, start: 10 },
      },
      resultsFromCloudSearch: {
        total: 1230,
        items: [
          { id: 'RESOURCE_1', name: 'Resource 1', highlights: {} },
          { id: 'RESOURCE_3', name: 'Resource 3', highlights: {} },
          { id: 'RESOURCE_2', name: 'Resource 2', highlights: {} },
        ],
      },
      expectedSearchLimit: 200,
      expectedTotal: 1230,
      resultsFromDb: baselineResultSet,
    },
    {
      description:
        "CloudSearch returns names that don't match the name in the DB - uses database name instead of CloudSearch name",
      input: {
        generalSearchTerm: 'Res',
        pagination: { limit: 500, start: 10 },
      },
      resultsFromCloudSearch: {
        total: 1230,
        items: [
          { id: 'RESOURCE_1', name: 'Search Resource 1', highlights: {} },
          { id: 'RESOURCE_2', name: 'Search Resource 2', highlights: {} },
        ],
      },
      expectedSearchLimit: 200,
      expectedTotal: 1230,
      resultsFromDb: baselineResultSet,
    },
  ];

  each(searchResourcesTestCases).test(
    '$description',
    async ({
      resultsFromCloudSearch,
      input,
      resultsFromDb,
      expectedTotal,
      expectedSearchLimit,
      expectedResults,
    }: SearchResourcesTestCaseParameters) => {
      mockSearchClientSearch.mockResolvedValue(resultsFromCloudSearch);
      mockGetByIdList.mockResolvedValue(resultsFromDb);
      const res = await searchResources('AC_FAKE_ACCOUNT', input);
      expect(res.totalCount).toBe(expectedTotal);
      expect(res.results).toStrictEqual(
        expectedResults ??
          resultsFromDb.map(
            ({
              stringAttributes,
              booleanAttributes,
              dateTimeAttributes,
              numberAttributes,
              referenceStringAttributes,
              lastUpdated,
              ...r
            }) => ({
              ...r,
              attributes: {
                ...(r.id === 'RESOURCE_1'
                  ? {
                      testAttribute: [
                        { value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
                      ],
                    }
                  : {}),
              },
            }),
          ),
      );
      expect(mockMapSearchParametersToKhpTermsAndFilters).toHaveBeenCalledWith(input);
      expect(mockSearchClientSearch).toHaveBeenCalledWith(
        'AC_FAKE_ACCOUNT',
        EMPTY_SEARCH_TERMS,
        input.pagination.start,
        expectedSearchLimit ?? input.pagination.limit,
      );
      expect(getByIdList).toHaveBeenCalledWith(
        'AC_FAKE_ACCOUNT',
        resultsFromCloudSearch.items.map(i => i.id),
      );
    },
  );

  each([
    {
      description:
        'Resource returned has multiple attribute entries with different keys and values - returns resource with an attribute object and a property for each key',
      attributeRecords: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
        { key: 'testAttribute2', value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } },
      ],
      expectedAttributes: {
        testAttribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
        testAttribute2: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
      },
    },
    {
      description:
        'Resource returned has multiple attribute entries with different keys and same value - returns resource with an attribute object and a property for each key',
      attributeRecords: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
        { key: 'testAttribute2', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
      ],
      expectedAttributes: {
        testAttribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
        testAttribute2: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
      },
    },
    {
      description:
        'Resource returned has multiple attribute entries with different values and same keys - returns resource with an attribute object and a property with an array entry for each value',
      attributeRecords: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
        { key: 'testAttribute', value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } },
      ],
      expectedAttributes: {
        testAttribute: [
          { value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
          { value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } },
        ],
      },
    },
    {
      description:
        'Resource returned has multiple attribute entries with same values and same keys but different languages - returns resource with an attribute object and a property with an array entry for each language',
      attributeRecords: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
        {
          key: 'testAttribute',
          value: 'testValue',
          language: 'Romulan',
          info: { jolan: 'tru' },
        },
      ],
      expectedAttributes: {
        testAttribute: [
          { value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
          { value: 'testValue', language: 'Romulan', info: { jolan: 'tru' } },
        ],
      },
    },
    {
      description:
        'Resource returned has attribute entries with keys that have forward slashes in their names - creates a nested object from the path',
      attributeRecords: [
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
    {
      description:
        'Resource returned has attribute entries with path keys that share a common root - attributes with a common root path share a common root object',
      attributeRecords: [
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested2/attribute',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
          nested2: {
            attribute: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
    {
      description:
        'Resource returned has attribute entries with forward slashes escaped with backslashes - removes backslashes and treats the forward slash as part of the path text',
      attributeRecords: [
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested2\\/attribute',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
          'nested2/attribute': [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
        },
      },
    },
    {
      description:
        'Resource returned has attribute keys with forward slashes after escaped backslash - unescapes backslash and treats the forward slash as a separator',
      attributeRecords: [
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested2\\\\/attribute',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
          'nested2\\': {
            attribute: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
    {
      description:
        'Resource returned has attribute keys with adjacent forward slashes - treats adjacent forward slashes as a single separator',
      attributeRecords: [
        {
          key: 'test///nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested2////attribute',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
          },
          nested2: {
            attribute: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
    {
      description:
        'Resource returned has attribute keys that form ancestor paths of other keys - values for ancestors are put on a __values__ property of the ancestor object',
      attributeRecords: [
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
            __values__: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
    {
      description:
        'Resource returned has attribute keys that form ancestor paths of other keys but ancestor is added first - values for ancestors are still put on a __values__ property of the ancestor object',
      attributeRecords: [
        {
          key: 'test/nested',
          value: 'testValue2',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
        {
          key: 'test/nested/attribute',
          value: 'testValue',
          language: 'Klingon',
          info: { qa: 'pla' },
        },
      ],
      expectedAttributes: {
        test: {
          nested: {
            attribute: [{ value: 'testValue', language: 'Klingon', info: { qa: 'pla' } }],
            __values__: [{ value: 'testValue2', language: 'Klingon', info: { qa: 'pla' } }],
          },
        },
      },
    },
  ]).test('$description', async ({ attributeRecords, expectedAttributes }) => {
    const resultSet = [generateResourceRecord('1')];
    mockSearchClientSearch.mockResolvedValue({
      items: [
        {
          id: 'RESOURCE_1',
          name: 'Resource 1',
          highlights: {},
        },
      ],
      total: 1,
    });
    mockGetByIdList.mockResolvedValue(
      resultSet.map(rs => ({ ...rs, stringAttributes: attributeRecords })),
    );
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      generalSearchTerm: 'Res',
      filters: {},
      pagination: { limit: 5, start: 0 },
    });
    expect(res.results).toStrictEqual([
      {
        id: 'RESOURCE_1',
        name: 'Resource 1',
        attributes: expectedAttributes,
      },
    ]);
  });
});
