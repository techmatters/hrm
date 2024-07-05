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
type GenerateMustNotFilterParams<T extends {}> = {
  type: 'mustNot';
  innerQuery: GenerateFilterParams<T>;
};
type GenerateNestedFilterParams<T extends {}> = {
  type: 'nested';
  path: keyof T;
  innerQuery: GenerateFilterParams<T>;
};

type GenerateFilterParams<T extends {}> =
  | ({ field: keyof T; parentPath?: string } & (
      | GenerateTermFilterParams
      | GenerateRangeFilterParams
    ))
  | GenerateMustNotFilterParams<T>
  | GenerateNestedFilterParams<T>;

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
  const prefix = p.parentPath ? `${p.parentPath}` : '';

  return `${prefix}${String(p.field)}`;
};

/** Utility function that creates a filter based on a more human-readable representation */
export const generateESFilter = <T extends {}>(
  p: GenerateFilterParams<T>,
): QueryDslQueryContainer => {
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
          must_not: generateESFilter(p.innerQuery),
        },
      };
    }
    case 'nested': {
      return {
        nested: {
          path: String(p.path),
          query: {
            bool: {
              must: [generateESFilter(p.innerQuery)],
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
  parentPath,
}: {
  searchTerm: string;
  transcriptFilters: QueryDslQueryContainer[][];
  parentPath?: string;
}): QueryDslQueryContainer[] => {
  const transcriptKey = getFieldName({ field: 'transcript', parentPath });

  return transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      must: [
        {
          match: {
            [transcriptKey]: searchTerm,
          },
        },
      ],
    },
  }));
};

const generateContactsQueriesFromFilters = ({
  searchParameters,
  parentPath,
}: {
  searchParameters: SearchParametersContact;
  parentPath?: string;
}) => {
  const {
    searchTerm,
    searchFilters,
    permissionFilters: { contactFilters, transcriptFilters },
  } = searchParameters;

  const transcriptQueries = generateTranscriptQueriesFromFilters({
    searchTerm,
    transcriptFilters,
    parentPath,
  });

  const contentKey = getFieldName({ field: 'content', parentPath });

  const contactQueries = contactFilters.map(contactFilter => ({
    bool: {
      filter: [...contactFilter, ...searchFilters],
      should: [
        {
          bool: {
            must: [
              {
                match: {
                  [contentKey]: searchTerm,
                },
              },
            ],
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
  parentPath,
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
        should: generateContactsQueriesFromFilters({ searchParameters, parentPath }),
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

export const casePathToContacts = 'contacts.';

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
    parentPath: casePathToContacts,
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

//
//
// TODO: fix contacts.content and contacts.transcript not properly being prefixed here :)
//
//

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
