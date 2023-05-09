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

import { mapSearchParametersToKhpTermsAndFilters } from '../../../../src/resource/search/khp-resource-search-mapping';
import { SearchParameters, TermsAndFilters } from '../../../../src/resource/search/search-types';
import each from 'jest-each';

describe('mapSearchParametersToKhpTermsAndFilters', () => {
  const pagination = { limit: 10, start: 0 };

  type MappingTestCaseParameters = {
    description: string;
    generalSearchTerm: string;
    filters?: SearchParameters['filters'];
    expectedTermsAndFilters: TermsAndFilters;
  };

  const testCases: MappingTestCaseParameters[] = [
    {
      description: 'empty general search term and no filters - return empty terms',
      generalSearchTerm: '',
      filters: {},
      expectedTermsAndFilters: { searchTermsByIndex: {}, filters: {} },
    },
    {
      description:
        'single word general search term and no filters - return word as term for name index and both generic indexes',
      generalSearchTerm: 'word',
      filters: {},
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: { terms: ['word'], phrases: [], weighting: 3 },
          search_terms_en_1: { terms: ['word'], phrases: [], weighting: 2 },
          search_terms_en_2: { terms: ['word'], phrases: [], weighting: 1 },
        },
        filters: {},
      },
    },
    {
      description:
        'multiple unquoted words as general search term and no filters - return words as terms for name index and both generic indexes',
      generalSearchTerm: 'word up',
      filters: {},
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: { terms: ['word', 'up'], phrases: [], weighting: 3 },
          search_terms_en_1: { terms: ['word', 'up'], phrases: [], weighting: 2 },
          search_terms_en_2: { terms: ['word', 'up'], phrases: [], weighting: 1 },
        },
        filters: {},
      },
    },
    {
      description:
        'quoted phrase as general search term and no filters - return phrase as phrase for name index and both generic indexes',
      generalSearchTerm: '"word up"',
      filters: {},
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: { terms: [], phrases: ['word up'], weighting: 3 },
          search_terms_en_1: { terms: [], phrases: ['word up'], weighting: 2 },
          search_terms_en_2: { terms: [], phrases: ['word up'], weighting: 1 },
        },
        filters: {},
      },
    },
    {
      description: 'quote without closing quote - treated like a character in a word',
      generalSearchTerm: 'word"up',
      filters: {},
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: { terms: ['word"up'], phrases: [], weighting: 3 },
          search_terms_en_1: { terms: ['word"up'], phrases: [], weighting: 2 },
          search_terms_en_2: { terms: ['word"up'], phrases: [], weighting: 1 },
        },
        filters: {},
      },
    },
    {
      // This test highlights a small bug in the current implementation. ' Everybody say ' should be considered 'words in between 2 phrases' and not a phrase in its own right
      // I can't see a way to fix this with a regex, it would need reimplementing with a stateful parser, which I don't think is worth doing for such an unlikely edge case
      description:
        'multiple quoted phrases and single unquoted words - breaks them up into words and phrases',
      generalSearchTerm: 'Word "up hey" Everybody say "when you hear the" call',
      filters: {},
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the'],
            weighting: 3,
          },
          search_terms_en_1: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the'],
            weighting: 2,
          },
          search_terms_en_2: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the'],
            weighting: 1,
          },
        },
        filters: {},
      },
    },
    {
      description:
        'filters specified with string values - includes the filter terms in the generic indexes as phrases, but not the name index',
      generalSearchTerm: 'Word "up hey" Everybody say "when you hear the" call',
      filters: {
        you: 'got',
        to: 'get',
        it: 'underway',
      },
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the'],
            weighting: 3,
          },
          search_terms_en_1: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the', 'got', 'get', 'underway'],
            weighting: 2,
          },
          search_terms_en_2: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the', 'got', 'get', 'underway'],
            weighting: 1,
          },
        },
        filters: {},
      },
    },
    {
      description: 'filters specified with non string values - ignored.',
      generalSearchTerm: 'Word "up hey" Everybody say "when you hear the" call',
      filters: {
        you: 'got',
        to: ['get', 'it'],
        underway: true,
        word: 1337,
      },
      expectedTermsAndFilters: {
        searchTermsByIndex: {
          name: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the'],
            weighting: 3,
          },
          search_terms_en_1: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the', 'got'],
            weighting: 2,
          },
          search_terms_en_2: {
            terms: ['Word', 'call'],
            phrases: ['up hey', ' Everybody say ', 'when you hear the', 'got'],
            weighting: 1,
          },
        },
        filters: {},
      },
    },
  ];

  each(testCases).test(
    '$description',
    ({ generalSearchTerm, filters, expectedTermsAndFilters }: MappingTestCaseParameters) => {
      const parameters: SearchParameters = {
        generalSearchTerm,
        filters,
        pagination,
      };
      const termsAndFilters = mapSearchParametersToKhpTermsAndFilters(parameters);

      expect(termsAndFilters).toStrictEqual(expectedTermsAndFilters);
    },
  );
});
