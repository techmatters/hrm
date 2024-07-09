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

type GenerateTermQueryParams = { type: 'term'; term: string };
type GenerateRangeQueryParams = {
  type: 'range';
  ranges: { lt?: string; lte?: string; gt?: string; gte?: string };
};
type GenerateMustNotQueryParams<T extends {}> = {
  type: 'mustNot';
  innerQuery: GenerateQueryParams<T, never>;
};
type GenerateNestedQueryParams<T extends {}, P extends keyof T> = {
  type: 'nested';
  path: P;
  innerQuery: GenerateQueryParams<
    T[P] extends Array<infer U extends {}> ? U : never,
    never
  >;
};

type GenerateQueryParams<T extends {}, P extends keyof T> =
  | ({ field: keyof T; parentPath?: string } & (
      | GenerateTermQueryParams
      | GenerateRangeQueryParams
    ))
  | GenerateMustNotQueryParams<T>
  | GenerateNestedQueryParams<T, P>;

export const FILTER_ALL_CLAUSE: QueryDslQueryContainer[][] = [
  [
    {
      bool: {
        must_not: { match_all: {} },
      },
    },
  ],
];

const getFieldName = <T extends {}>(p: { field: keyof T; parentPath?: string }) => {
  const prefix = p.parentPath ? `${p.parentPath}.` : '';

  return `${prefix}${String(p.field)}`;
};

/** Utility function that creates a filter based on a more human-readable representation */
export const generateESQuery = (p: GenerateQueryParamsObject): QueryDslQueryContainer => {
  switch (p.type) {
    case 'term': {
      return {
        term: {
          [getFieldName(p)]: p.term,
        },
      };
    }
    case 'range': {
      return {
        range: {
          [getFieldName(p)]: p.ranges,
        },
      };
    }
    case 'mustNot': {
      return {
        bool: {
          must_not: generateESQuery(p.innerQuery),
        },
      };
    }
    case 'nested': {
      return {
        nested: {
          path: String(p.path),
          query: {
            bool: {
              must: [generateESQuery(p.innerQuery)],
            },
          },
        },
      };
    }
    default: {
      return assertExhaustive(p);
    }
  }
};

export type GenerateContactQueryParams = GenerateQueryParams<ContactDocument, never>;
export type GenerateCaseQueryParams = GenerateQueryParams<CaseDocument, 'contacts'>;
export type GenerateQueryParamsObject =
  | GenerateContactQueryParams
  | GenerateCaseQueryParams;

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
  transcriptFilters,
  generateQueryParams,
}: {
  transcriptFilters: QueryDslQueryContainer[][];
  generateQueryParams: GenerateQueryParamsObject;
}): QueryDslQueryContainer[] => {
  return transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      must: [generateESQuery(generateQueryParams)],
    },
  }));
};

const generateContactsQueriesFromFilters = ({
  searchParameters,
  generateTranscriptQueryParams,
  generateContactQueryParams,
}: {
  searchParameters: SearchParametersContact;
  generateTranscriptQueryParams: GenerateQueryParamsObject;
  generateContactQueryParams: GenerateQueryParamsObject;
}) => {
  const {
    searchFilters,
    permissionFilters: { contactFilters, transcriptFilters },
  } = searchParameters;

  const transcriptQueries = generateTranscriptQueriesFromFilters({
    transcriptFilters,
    generateQueryParams: generateTranscriptQueryParams,
  });

  const contactQueries = contactFilters.map(contactFilter => ({
    bool: {
      filter: [...contactFilter, ...searchFilters],
      should: [
        {
          bool: {
            must: [generateESQuery(generateContactQueryParams)],
          },
        },
        ...transcriptQueries,
      ],
    },
  }));

  return contactQueries;
};

const generateContactsQuery = ({
  index,
  searchParameters,
}: {
  index: string;
  searchParameters: SearchParametersContact;
  parentPath?: string;
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
    query: {
      bool: {
        should: generateContactsQueriesFromFilters({
          searchParameters,
          generateContactQueryParams: {
            field: 'content',
            type: 'term',
            term: searchParameters.searchTerm,
          } as GenerateContactQueryParams,
          generateTranscriptQueryParams: {
            field: 'transcript',
            type: 'term',
            term: searchParameters.searchTerm,
          } as GenerateContactQueryParams,
        }),
      },
    },
  };
};

type SearchParametersCases = {
  type: 'case';
  searchTerm: string;
  searchFilters: QueryDslQueryContainer[];
  permissionFilters: {
    contactFilters: QueryDslQueryContainer[][];
    transcriptFilters: QueryDslQueryContainer[][];
    caseFilters: QueryDslQueryContainer[][];
  };
} & SearchPagination;

export const casePathToContacts = 'contacts';

const generateCasesQueriesFromFilters = ({
  searchParameters,
}: {
  searchParameters: SearchParametersCases;
}) => {
  const {
    searchTerm,
    searchFilters,
    permissionFilters: { caseFilters },
  } = searchParameters;

  const contactQueries = generateContactsQueriesFromFilters({
    searchParameters: { ...searchParameters, type: 'contact' },
    generateContactQueryParams: {
      type: 'nested',
      path: casePathToContacts,
      innerQuery: {
        type: 'term',
        field: 'content',
        term: searchParameters.searchTerm,
        parentPath: casePathToContacts,
      },
    } as GenerateCaseQueryParams,
    generateTranscriptQueryParams: {
      type: 'nested',
      path: casePathToContacts,
      innerQuery: {
        type: 'term',
        field: 'transcript',
        term: searchParameters.searchTerm,
        parentPath: casePathToContacts,
      },
    } as GenerateCaseQueryParams,
  });

  const caseQueries = caseFilters.map(caseFilter => ({
    bool: {
      filter: [...caseFilter, ...searchFilters],
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
        ...contactQueries,
      ],
    },
  }));

  return caseQueries;
};

const generateCasesQuery = ({
  index,
  searchParameters,
}: {
  index: string;
  searchParameters: SearchParametersCases;
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
    query: {
      bool: {
        should: generateCasesQueriesFromFilters({ searchParameters }),
      },
    },
  };
};

export type SearchParameters = SearchParametersContact | SearchParametersCases;

const isValidSearchParams = (p: any, type: string) =>
  typeof p === 'object' && p && p.type === type;

type GenerateIndexQueryParams = { index: string; searchParameters: SearchParameters };
const isSearchParametersContacts = (p: any): p is SearchParametersContact =>
  isValidSearchParams(p, 'contact');

const isSearchParametersCases = (p: any): p is SearchParametersCases =>
  isValidSearchParams(p, 'case');

export const generateElasticsearchQuery = (p: GenerateIndexQueryParams): SearchQuery => {
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
