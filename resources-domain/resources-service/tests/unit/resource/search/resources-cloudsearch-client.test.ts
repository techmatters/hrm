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
  CloudSearchDomainClient,
  SearchCommandInput,
  SearchCommandOutput,
} from '@aws-sdk/client-cloudsearch-domain';
import client, {
  SearchResultSet,
} from '../../../../src/resource/search/resource-cloudsearch-client';
import { AccountSID } from '@tech-matters/types';
import { TermsAndFilters } from '../../../../src/resource/search/search-types';
import each from 'jest-each';

jest.mock('@aws-sdk/client-cloudsearch-domain', () => ({
  CloudSearchDomainClient: jest.fn(),
  SearchCommand: jest.fn().mockImplementation((input: SearchCommandInput) => input),
}));

const MockCloudSearchDomainClient = CloudSearchDomainClient as jest.Mock<CloudSearchDomainClient>;

let mockCloudSearchDomainClient: CloudSearchDomainClient;

const EMPTY_CLOUDSEARCH_RESULT: SearchCommandOutput = {
  $metadata: {
    httpStatusCode: 200,
  },
  hits: {
    found: 0,
    hit: [],
    start: 0,
  },
  status: {
    rid: 'rid',
    timems: 0,
  },
};

const EMPTY_RESULT: SearchResultSet = {
  total: 0,
  items: [],
};

describe('client', () => {
  const mockSearchEndpoint = new URL('https://searchy-searchy.com');

  beforeEach(() => {
    MockCloudSearchDomainClient.mockImplementation(() => {
      mockCloudSearchDomainClient = {
        config: {} as any,
        destroy: jest.fn(),
        send: jest.fn(),
        middlewareStack: {} as any,
      };
      return mockCloudSearchDomainClient;
    });
  });
  test('Valid config - passes search url from config into a new CloudSearchDomainClient', () => {
    client({ searchUrl: mockSearchEndpoint });
    expect(MockCloudSearchDomainClient).toHaveBeenCalledWith({
      endpoint: mockSearchEndpoint.toString(),
    });
  });
  test('No search URL in config - throws', () => {
    expect(() => client({ searchUrl: undefined } as any)).toThrow();
  });
  describe('search', () => {
    let cloudSearchClient: ReturnType<typeof client>;
    let mockCloudSearchSend: jest.Mock<Promise<SearchCommandOutput>>;

    beforeEach(() => {
      cloudSearchClient = client({ searchUrl: mockSearchEndpoint });
      mockCloudSearchSend = mockCloudSearchDomainClient.send as jest.Mock<
        Promise<SearchCommandOutput>
      >;
    });

    type SearchInputTestParameters = {
      inputDescription: string;
      input: TermsAndFilters;
      expectedQueryDescription: string;
      expectedQuery: string;
      limit?: number;
      start?: number;
    };

    const inputTestParameters: SearchInputTestParameters[] = [
      {
        inputDescription: 'one index and one phrase',
        input: {
          searchTermsByIndex: {
            ['test-index']: { phrases: ['searchy-searchy'], terms: [], weighting: 1 },
          },
          filters: {},
        },
        expectedQueryDescription: "a single 'or' phrase clause",
        expectedQuery: "(or (phrase field='test-index' boost=1 'searchy-searchy'))",
      },
      {
        inputDescription: 'two indexes and one phrase each',
        input: {
          searchTermsByIndex: {
            ['test-index-1']: { phrases: ['searchy searchy'], terms: [], weighting: 1 },
            ['test-index-2']: { phrases: ['findy findy'], terms: [], weighting: 1 },
          },
          filters: {},
        },
        expectedQueryDescription: "two 'or' phrase clauses",
        expectedQuery:
          "(or (phrase field='test-index-1' boost=1 'searchy searchy')(phrase field='test-index-2' boost=1 'findy findy'))",
      },
      {
        inputDescription: 'one index and two phrases',
        input: {
          searchTermsByIndex: {
            ['test-index']: {
              phrases: ['searchy searchy', 'findy findy'],
              terms: [],
              weighting: 1,
            },
          },
          filters: {},
        },
        expectedQueryDescription: "a two 'or' phrase clauses for the same index",
        expectedQuery:
          "(or (phrase field='test-index' boost=1 'searchy searchy')(phrase field='test-index' boost=1 'findy findy'))",
      },
      {
        inputDescription: 'one index with two phrases and a term',
        input: {
          searchTermsByIndex: {
            ['test-index']: {
              phrases: ['searchy searchy', 'findy findy'],
              terms: ['word'],
              weighting: 1,
            },
          },
          filters: {},
        },
        expectedQueryDescription: "a two 'or' phrase clauses for the same index",
        expectedQuery:
          "(or (phrase field='test-index' boost=1 'searchy searchy')(phrase field='test-index' boost=1 'findy findy')(term field='test-index' boost=1 'word'))",
      },
      {
        inputDescription: 'different weightings',
        input: {
          searchTermsByIndex: {
            ['test-index-1']: {
              phrases: ['searchy searchy', 'findy findy'],
              terms: ['word'],
              weighting: 1,
            },
            ['test-index-2']: {
              phrases: ['searchy searchy', 'findy findy'],
              terms: ['word'],
              weighting: 3,
            },
          },
          filters: {},
        },
        expectedQueryDescription:
          'weightings converted to boosts for every clause associated with the index',
        expectedQuery:
          "(or (phrase field='test-index-1' boost=1 'searchy searchy')(phrase field='test-index-1' boost=1 'findy findy')(term field='test-index-1' boost=1 'word')(phrase field='test-index-2' boost=3 'searchy searchy')(phrase field='test-index-2' boost=3 'findy findy')(term field='test-index-2' boost=3 'word'))",
      },
      {
        inputDescription: 'single quote in phrase',
        input: {
          searchTermsByIndex: {
            ['test-index-1']: {
              phrases: ["searchy o'searchy", "findy o'findy"],
              terms: ["word's"],
              weighting: 1,
            },
          },
          filters: {},
        },
        expectedQueryDescription: 'single quotes in phrases are escaped with a backslash',
        expectedQuery:
          "(or (phrase field='test-index-1' boost=1 'searchy o\\'searchy')(phrase field='test-index-1' boost=1 'findy o\\'findy')(term field='test-index-1' boost=1 'word\\'s'))",
      },
      {
        inputDescription: 'spaces in term',
        input: {
          searchTermsByIndex: {
            ['test-index-1']: {
              phrases: ['searchy searchy', 'findy findy'],
              terms: ['wordy wordy'],
              weighting: 1,
            },
          },
          filters: {},
        },
        expectedQueryDescription: 'term as specified',
        expectedQuery:
          "(or (phrase field='test-index-1' boost=1 'searchy searchy')(phrase field='test-index-1' boost=1 'findy findy')(term field='test-index-1' boost=1 'wordy wordy'))",
      },
      {
        inputDescription: 'with limit and start specified',
        input: {
          searchTermsByIndex: {
            ['test-index']: { phrases: ['searchy-searchy'], terms: [], weighting: 1 },
          },
          filters: {},
        },
        expectedQueryDescription:
          'parameters passed through and the size set to the limit and start set to the start',
        expectedQuery: "(or (phrase field='test-index' boost=1 'searchy-searchy'))",
        start: 1337,
        limit: 42,
      },
    ];
    each(inputTestParameters).test(
      'Search $inputDescription - builds a structured query with $expectedQueryDescription, adds a filter for the account SID, and passes it to the CloudSearchDomainClient',
      async ({ input, expectedQuery, start = 0, limit = 10 }: SearchInputTestParameters) => {
        const mockAccountSid = 'AC123' as AccountSID;
        mockCloudSearchSend.mockResolvedValue(EMPTY_CLOUDSEARCH_RESULT);
        const result = await cloudSearchClient.search(mockAccountSid, input, start, limit);
        expect(mockCloudSearchSend).toHaveBeenCalledWith({
          query: expectedQuery,
          queryParser: 'structured',
          filterQuery: `account_sid:'${mockAccountSid}'`,
          size: limit,
          start,
        });
        expect(result).toStrictEqual(EMPTY_RESULT);
      },
    );

    type SearchOutputTestParameters = {
      cloudSearchResultDescription: string;
      cloudSearchResult: SearchCommandOutput;
      expectedResultDescription: string;
      expectedResult: SearchResultSet;
    };

    const outputTestParameters: SearchOutputTestParameters[] = [
      {
        cloudSearchResultDescription: 'no results',
        cloudSearchResult: EMPTY_CLOUDSEARCH_RESULT,
        expectedResultDescription: 'an empty result set',
        expectedResult: EMPTY_RESULT,
      },
      {
        cloudSearchResultDescription: 'result with no hits',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
        },
        expectedResultDescription: 'an empty result set',
        expectedResult: EMPTY_RESULT,
      },
      {
        cloudSearchResultDescription: 'result with found property but no hits',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: { found: 1337 },
        },
        expectedResultDescription: 'found value as total',
        expectedResult: { ...EMPTY_RESULT, total: 1337 },
      },
      {
        cloudSearchResultDescription: 'result with found property but hits',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BOB'],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'found value as zero',
        expectedResult: { items: [{ id: 'BOBS ID', name: 'BOB', highlights: {} }], total: 0 },
      },
      {
        cloudSearchResultDescription: 'result with hits with populated name field',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BOB'],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'name field as first name field value and id as id',
        expectedResult: { items: [{ id: 'BOBS ID', name: 'BOB', highlights: {} }], total: 1337 },
      },
      {
        cloudSearchResultDescription: 'result with hits with name field that has multiple values',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BUB', 'BOB'],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'name field as first name field value and id as id',
        expectedResult: { items: [{ id: 'BOBS ID', name: 'BUB', highlights: {} }], total: 1337 },
      },
      {
        cloudSearchResultDescription: 'result with hits with name field that has no values',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: [],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'name field as undefined',
        expectedResult: {
          items: [{ id: 'BOBS ID', name: undefined, highlights: {} }],
          total: 1337,
        },
      },
      {
        cloudSearchResultDescription: 'result with hits with no name field',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {},
              },
            ],
          },
        },
        expectedResultDescription: 'name field as undefined',
        expectedResult: {
          items: [{ id: 'BOBS ID', name: undefined, highlights: {} }],
          total: 1337,
        },
      },
      {
        cloudSearchResultDescription: 'result with hits with no fields object',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
              },
            ],
          },
        },
        expectedResultDescription: 'name field as undefined',
        expectedResult: {
          items: [{ id: 'BOBS ID', name: undefined, highlights: {} }],
          total: 1337,
        },
      },
      {
        cloudSearchResultDescription: 'result with hits with other fields',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BOB'],
                  other: ['other'],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'results with other fields filtered out',
        expectedResult: { items: [{ id: 'BOBS ID', name: 'BOB', highlights: {} }], total: 1337 },
      },
      {
        cloudSearchResultDescription: 'result with hits with highlights',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BOB'],
                },
                highlights: {
                  something: 'here',
                },
              },
            ],
          },
        },
        expectedResultDescription: 'results with other fields filtered out',
        expectedResult: {
          items: [{ id: 'BOBS ID', name: 'BOB', highlights: { something: 'here' } }],
          total: 1337,
        },
      },
      {
        cloudSearchResultDescription: 'result with multiple hits',
        cloudSearchResult: {
          $metadata: { httpStatusCode: 200 },
          hits: {
            found: 1337,
            hit: [
              {
                id: 'BOBS ID',
                fields: {
                  name: ['BOB'],
                },
              },
              {
                id: 'BUBS ID',
                fields: {
                  name: ['BUB'],
                },
              },
            ],
          },
        },
        expectedResultDescription: 'all hits',
        expectedResult: {
          items: [
            { id: 'BOBS ID', name: 'BOB', highlights: {} },
            { id: 'BUBS ID', name: 'BUB', highlights: {} },
          ],
          total: 1337,
        },
      },
    ];
    each(outputTestParameters).test(
      'Valid search where cloudsearch returns $cloudSearchResultDescription - returns $expectedResultDescription',
      async ({ cloudSearchResult, expectedResult }: SearchOutputTestParameters) => {
        mockCloudSearchSend.mockResolvedValue(cloudSearchResult);
        const result = await cloudSearchClient.search(
          'AC123',
          {
            searchTermsByIndex: {
              ['test-index']: { phrases: ['searchy-searchy'], terms: [], weighting: 1 },
            },
            filters: {},
          },
          0,
          15,
        );
        expect(result).toStrictEqual(expectedResult);
      },
    );
  });
});
