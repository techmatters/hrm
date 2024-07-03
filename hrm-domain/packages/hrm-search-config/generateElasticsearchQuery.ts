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
import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { SearchQuery } from '@tech-matters/elasticsearch-client';
import {
  CaseDocument,
  ContactDocument,
  isHrmCasesIndex,
  isHrmContactsIndex,
} from './hrmIndexDocumentMappings';
import { assertExhaustive } from '@tech-matters/types';

type GenerateTermFilterParams = { type: 'term'; term: string };
type GenerateRangeFilterParams = {
  type: 'range';
  ranges: { lt?: string; lte?: string; gt?: string; gte?: string };
};

type GenerateFilterParams<T extends {}> = { field: keyof T } & (
  | GenerateTermFilterParams
  | GenerateRangeFilterParams
);

/** Utility function that creates a filter based on a more human-readable representation */
export const generateESFilter = <T extends {}>(
  p: GenerateFilterParams<T>,
): QueryDslQueryContainer => {
  switch (p.type) {
    case 'term': {
      return {
        term: {
          [p.field]: p.term,
        },
      };
    }
    case 'range': {
      return {
        range: {
          [p.field]: p.ranges,
        },
      };
    }
    default: {
      return assertExhaustive(p);
    }
  }
};

export type GenerateContactFilterParams = GenerateFilterParams<ContactDocument>;
export type GenerateCaseFilterParams = GenerateFilterParams<CaseDocument>;

type SearchPagination = {
  pagination: {
    limit: number;
    start: number;
  };
};

type SearchParametersContact = {
  type: 'contact';
  searchTerm: string;
  searchFilters: QueryDslQueryContainer[];
  permissionFilters: {
    contactFilters: QueryDslQueryContainer[][];
    transcriptFilters: QueryDslQueryContainer[][];
  };
} & SearchPagination;

const generateTranscriptQueriesFromFilters = ({
  searchTerm,
  transcriptFilters,
}: {
  searchTerm: string;
  transcriptFilters: QueryDslQueryContainer[][];
}): QueryDslQueryContainer[] =>
  transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      must: [
        {
          match: {
            transcript: searchTerm,
          },
        },
      ],
    },
  }));

const generateContactsQueriesFromFilters = ({
  searchParameters,
}: {
  searchParameters: SearchParametersContact;
}) => {
  const {
    searchTerm,
    searchFilters,
    permissionFilters: { contactFilters, transcriptFilters },
  } = searchParameters;

  const transcriptQueries = generateTranscriptQueriesFromFilters({
    searchTerm,
    transcriptFilters,
  });

  const contactQueries = contactFilters.map(contatFilter => ({
    bool: {
      filter: [...contatFilter, ...searchFilters],
      should: [
        {
          bool: {
            must: [
              {
                match: {
                  content: searchTerm,
                },
              },
            ],
          },
        },
        ...transcriptQueries,
      ],
    },
  }));

  return {
    bool: {
      should: contactQueries,
    },
  };
};

const generateContactsQuery = ({
  index,
  searchParameters,
}: {
  index: string;
  searchParameters: SearchParametersContact;
}): SearchQuery => {
  const { pagination } = searchParameters;

  return {
    index,
    highlight: {
      fields: { '*': {} },
    },
    min_score: 0.1,
    from: pagination.start,
    size: pagination.limit,
    query: generateContactsQueriesFromFilters({ searchParameters }),
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
