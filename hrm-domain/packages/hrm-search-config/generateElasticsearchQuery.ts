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
import { SearchQuery } from '@tech-matters/elasticsearch-client';
// import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { isHrmCasesIndex, isHrmContactsIndex } from './hrmIndexDocumentMappings';

type SearchPagination = {
  pagination: {
    limit: number;
    start: number;
  };
};

type SearchParametersContact = {
  type: 'contact';
  term: string;
  contactFilters: [];
  transcriptFilters: [];
} & SearchPagination;

const generateContactsQuery = ({
  index,
  searchParameters,
}: {
  index: string;
  searchParameters: SearchParametersContact;
}): SearchQuery => {
  const { term, contactFilters, transcriptFilters } = searchParameters;

  return {
    index,
    highlight: {
      fields: { '*': {} },
    },
    min_score: 0.1,
    from: searchParameters.pagination.start,
    size: searchParameters.pagination.limit,
    query: {
      bool: {
        filter: contactFilters,
        should: [
          {
            bool: {
              must: [
                {
                  match: {
                    content: term,
                  },
                },
              ],
            },
          },
          {
            bool: {
              filter: transcriptFilters,
              must: [
                {
                  match: {
                    transcript: term,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
};

type SearchParametersCases = {
  type: 'case';
} & SearchPagination;

const generateCasesQuery = ({
  index,
}: {
  index: string;
  searchParameters: SearchParametersCases;
}): SearchQuery => {
  return {
    index: index,
    highlight: {
      fields: { '*': {} },
    },
    min_score: 0.1,
    query: {
      bool: {
        filter: [],
        must: [
          {
            match_all: {},
          },
        ],
      },
    },
  };
};

export type SearchParameters = SearchParametersContact | SearchParametersCases;

const isValidSearchParams = (p: any, type: string) =>
  typeof p === 'object' && p && p.type === type;

type GenerateQueryParams = { index: string; searchParameters: SearchParameters };
const isSearchParametersContacts = (p: any): p is SearchParametersContact =>
  isValidSearchParams(p, 'contact');

const isSearchParametersCases = (p: any): p is SearchParametersCases =>
  isValidSearchParams(p, 'case');

export const generateElasticsearchQuery = (p: GenerateQueryParams): SearchQuery => {
  const { index, searchParameters } = p;

  if (isHrmContactsIndex(index) && isSearchParametersContacts(searchParameters)) {
    return generateContactsQuery({ index, searchParameters });
  }

  if (isHrmCasesIndex(index) && isSearchParametersCases(searchParameters)) {
    return generateCasesQuery({ index, searchParameters });
  }

  throw new Error(
    `generateElasticsearchQuery not implemented for index ${p.index} - searchParameters type ${p.searchParameters.type} `,
  );
};
