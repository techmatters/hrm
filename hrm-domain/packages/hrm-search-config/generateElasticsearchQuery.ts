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

type SearchParametersContact = {
  type: 'contact';
  term: string;
  contactFilters: {};
  transcriptFilters: {};
};

const generateContactsQuery = ({
  index,
}: {
  index: string;
  searchParameters: SearchParametersContact;
}): SearchQuery => {
  return {
    index,
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

type SearchParametersCases = {
  type: 'case';
};

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

type GenerateQueryParams = { index: string; searchParameters: SearchParameters };
const isSearchParametersContacts = (p: any): p is SearchParametersContact =>
  typeof p === 'object' &&
  p &&
  isHrmContactsIndex(p.index) &&
  p.searchParameters.type === 'contact';

const isSearchParametersCases = (p: any): p is SearchParametersCases =>
  typeof p === 'object' && p && p.searchParameters.type === 'case';

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
