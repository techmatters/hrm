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

type NestedDocumentsQueryParams = {
  contacts: GenerateContactQueryParams;
};

type GenerateTermQueryParams = { type: 'term'; term: string };
type GenerateRangeQueryParams = {
  type: 'range';
  ranges: { lt?: string; lte?: string; gt?: string; gte?: string };
};
<<<<<<< HEAD
type GenerateQueryStringQuery = { type: 'queryString'; query: string; boost?: number };
=======
>>>>>>> origin/master
type GenerateMustNotQueryParams = {
  type: 'mustNot';
  innerQuery: GenerateQueryParamsObject;
};
type GenerateNestedQueryParams<T extends {}, P extends keyof T> = {
  type: 'nested';
  path: P;
  innerQuery: P extends keyof NestedDocumentsQueryParams
    ? NestedDocumentsQueryParams[P]
    : never;
};
type GenerateQueryParams<T extends {}, P extends keyof T> =
  | ({ field: keyof T; parentPath?: string } & (
      | GenerateTermQueryParams
      | GenerateRangeQueryParams
<<<<<<< HEAD
      | GenerateQueryStringQuery
=======
>>>>>>> origin/master
    ))
  | GenerateMustNotQueryParams
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

<<<<<<< HEAD
export const MATCH_ALL_CLAUSE: QueryDslQueryContainer[] = [
  {
    match_all: {},
  },
];

=======
>>>>>>> origin/master
const getFieldName = <T extends {}>(p: { field: keyof T; parentPath?: string }) => {
  const prefix = p.parentPath ? `${p.parentPath}.` : '';

  return `${prefix}${String(p.field)}`;
};

export type GenerateContactQueryParams = GenerateQueryParams<ContactDocument, never> & {
  documentType: 'contact';
};
export type GenerateCaseQueryParams = GenerateQueryParams<CaseDocument, 'contacts'> & {
  documentType: 'case';
};
export type GenerateQueryParamsObject =
  | GenerateContactQueryParams
  | GenerateCaseQueryParams;

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
<<<<<<< HEAD
    case 'queryString': {
      return {
        query_string: {
          default_field: getFieldName(p),
          query: p.query,
          ...(p.boost && { boost: p.boost }),
        },
      };
    }
=======
>>>>>>> origin/master
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

<<<<<<< HEAD
const generateQueriesFromSearchTerms = ({
  searchTerm,
  documentType,
  field,
  parentPath,
  boostFactor,
  queryWrapper = p => p,
}: {
  searchTerm: string;
  boostFactor: number;
  queryWrapper?: (p: GenerateQueryParamsObject) => GenerateQueryParamsObject;
} & Pick<
  GenerateQueryParamsObject & { type: 'queryString' },
  'documentType' | 'field' | 'parentPath'
>) => {
  const terms = searchTerm.split(' ');

  const queries = [
    // query for exact matches on the term(s)
    ...(terms.length > 1
      ? [
          { query: terms.join('AND'), boost: 3 * boostFactor },
          { query: terms.join(' '), boost: 2 * boostFactor },
        ]
      : [{ query: terms.join(''), boost: 2 * boostFactor }]),

    // query for partial matches on the term(s)
    { query: terms.map(t => `*${t}*`).join(' '), boost: 1.5 * boostFactor },

    // query for fuzzy matches on the term(s)
    { query: terms.map(t => `${t}~1`).join(' '), boost: 1 * boostFactor },
  ].map(({ boost, query }) =>
    generateESQuery(
      queryWrapper({
        documentType,
        type: 'queryString',
        query,
        boost,
        field: field as any,
        parentPath,
      }),
    ),
  );

  return queries;
};

const boostaFactors = {
  transcript: 1,
  contact: 2,
  case: 3,
};
const minScore = 0.1;

const generateTranscriptQueriesFromFilters = ({
  transcriptFilters,
  searchParameters,
  buildParams = { parentPath: '' },
  queryWrapper = p => p,
}: {
  transcriptFilters: QueryDslQueryContainer[][];
  searchParameters: SearchParametersContact;
  buildParams?: { parentPath: string };
  queryWrapper?: (p: GenerateQueryParamsObject) => GenerateQueryParamsObject;
}): QueryDslQueryContainer[] => {
  const queries = generateQueriesFromSearchTerms({
    documentType: 'contact',
    field: 'transcript',
    searchTerm: searchParameters.searchTerm,
    parentPath: buildParams.parentPath,
    boostFactor: boostaFactors.transcript,
    queryWrapper,
  });

  return transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      should: queries.map(q => ({
        bool: { must: [q] },
      })),
=======
const generateTranscriptQueriesFromFilters = ({
  transcriptFilters,
  searchParameters,
  buildParams = { parentPath: '' },
  queryWrapper = p => p,
}: {
  transcriptFilters: QueryDslQueryContainer[][];
  searchParameters: SearchParametersContact;
  buildParams?: { parentPath: string };
  queryWrapper?: (p: GenerateContactQueryParams) => GenerateQueryParamsObject;
}): QueryDslQueryContainer[] => {
  return transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      must: [
        generateESQuery(
          queryWrapper({
            documentType: 'contact',
            field: 'transcript',
            type: 'term',
            term: searchParameters.searchTerm,
            parentPath: buildParams.parentPath,
          }),
        ),
      ],
>>>>>>> origin/master
    },
  }));
};

const generateContactsQueriesFromFilters = ({
  searchParameters,
  buildParams = { parentPath: '' },
  queryWrapper = p => p,
}: {
  searchParameters: SearchParametersContact;
  buildParams?: { parentPath: string };
<<<<<<< HEAD
  queryWrapper?: (p: GenerateQueryParamsObject) => GenerateQueryParamsObject;
}) => {
  const { searchFilters, permissionFilters } = searchParameters;

  if (searchParameters.searchTerm.length === 0) {
    return permissionFilters.contactFilters.map(contactFilter => ({
      bool: {
        filter: [...contactFilter, ...searchFilters],
        should: MATCH_ALL_CLAUSE,
      },
    }));
  }

  const transcriptQueries = generateTranscriptQueriesFromFilters({
    transcriptFilters: permissionFilters.transcriptFilters,
    searchParameters,
    buildParams,
    queryWrapper,
=======
  queryWrapper?: (p: GenerateContactQueryParams) => GenerateQueryParamsObject;
}) => {
  const {
    searchFilters,
    permissionFilters: { contactFilters, transcriptFilters },
  } = searchParameters;

  const transcriptQueries = generateTranscriptQueriesFromFilters({
    transcriptFilters,
    searchParameters,
    buildParams,
>>>>>>> origin/master
  });

  const queries = generateQueriesFromSearchTerms({
    documentType: 'contact',
    field: 'content',
    searchTerm: searchParameters.searchTerm,
    parentPath: buildParams.parentPath,
    boostFactor: boostaFactors.contact,
    queryWrapper,
  });

  const contactQueries = permissionFilters.contactFilters.map(contactFilter => ({
    bool: {
      filter: [...contactFilter, ...searchFilters],
      should: [
<<<<<<< HEAD
        ...queries.map(q => ({
          bool: { must: [q] },
        })),
        ...transcriptQueries,
=======
        {
          bool: {
            must: [
              generateESQuery(
                queryWrapper({
                  documentType: 'contact',
                  field: 'content',
                  type: 'term',
                  term: searchParameters.searchTerm,
                  parentPath: buildParams.parentPath,
                }),
              ),
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
    queryWrapper: p => ({
      documentType: 'case',
      type: 'nested',
      path: casePathToContacts,
      innerQuery: p,
    }),
    buildParams: { parentPath: casePathToContacts },
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
>>>>>>> origin/master
      ],
    },
  }));

<<<<<<< HEAD
  return contactQueries;
=======
  return caseQueries;
>>>>>>> origin/master
};

const generateCasesQuery = ({
  index,
  searchParameters,
}: {
  index: string;
<<<<<<< HEAD
  searchParameters: SearchParametersContact;
  parentPath?: string;
=======
  searchParameters: SearchParametersCases;
>>>>>>> origin/master
}): SearchQuery => {
  const { pagination } = searchParameters;

  return {
    index,
    highlight: {
      fields: { '*': {} },
    },
    min_score: minScore,
    from: pagination.start,
    size: pagination.limit,
<<<<<<< HEAD
    query: {
      bool: {
        should: generateContactsQueriesFromFilters({
          searchParameters,
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
  const { searchFilters, permissionFilters } = searchParameters;

  if (searchParameters.searchTerm.length === 0) {
    return permissionFilters.caseFilters.map(caseFilter => ({
      bool: {
        filter: [...caseFilter, ...searchFilters],
        should: MATCH_ALL_CLAUSE,
      },
    }));
  }

  const contactQueries = generateContactsQueriesFromFilters({
    searchParameters: { ...searchParameters, type: 'contact' },
    queryWrapper: p => ({
      documentType: 'case',
      type: 'nested',
      path: casePathToContacts,
      innerQuery: p as GenerateContactQueryParams,
    }),
    buildParams: { parentPath: casePathToContacts },
  });

  const queries = generateQueriesFromSearchTerms({
    documentType: 'case',
    field: 'content',
    searchTerm: searchParameters.searchTerm,
    boostFactor: boostaFactors.case,
  });

  const caseQueries = permissionFilters.caseFilters.map(caseFilter => ({
    bool: {
      filter: [...caseFilter, ...searchFilters],
      should: [
        ...queries.map(q => ({
          bool: { must: [q] },
        })),
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
    min_score: minScore,
    from: pagination.start,
    size: pagination.limit,
=======
>>>>>>> origin/master
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
