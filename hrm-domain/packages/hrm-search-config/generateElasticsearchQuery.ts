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
import type { SearchQuery } from '@tech-matters/elasticsearch-client';
import {
  DocumentType,
  type DocumentTypeToDocument,
  type NestedDocumentTypesRelations,
  casePathToContacts,
  casePathToSections,
  isHrmCasesIndex,
  isHrmContactsIndex,
} from './hrmIndexDocumentMappings';
import { assertExhaustive } from '@tech-matters/types';

const BOOST_FACTORS = {
  id: 10,
  transcript: 1,
  contact: 2,
  case: 3,
};
const MIN_SCORE = 0.1;
const MAX_INT = 2147483648 - 1; // 2^31 - 1, the max integer allowed by ElasticSearch integer type

export const FILTER_ALL_CLAUSE: QueryDslQueryContainer[][] = [
  [
    {
      bool: {
        must_not: { match_all: {} },
      },
    },
  ],
];

export const MATCH_ALL_CLAUSE: QueryDslQueryContainer[] = [
  {
    match_all: {},
  },
];

type GenerateTDocQueryParams<TDoc extends DocumentType> = GenerateQueryParams<TDoc> & {
  documentType: TDoc; // used as tag (tagged union)
};

export type DocumentTypeQueryParams = {
  [DocumentType.Contact]: GenerateTDocQueryParams<DocumentType.Contact>;
  [DocumentType.CaseSection]: GenerateTDocQueryParams<DocumentType.CaseSection>;
  [DocumentType.Case]: GenerateTDocQueryParams<DocumentType.Case>;
};

type GenerateTermQueryParams = {
  type: 'term';
  term: string | boolean | number;
  boost?: number;
};
type GenerateRangeQueryParams = {
  type: 'range';
  ranges: { lt?: string; lte?: string; gt?: string; gte?: string };
};
type GenerateQueryStringQuery = { type: 'queryString'; query: string; boost?: number };
type GenerateSimpleQueryStringQuery = {
  type: 'simpleQueryString';
  query: string;
  boost?: number;
};
type GenerateMustNotQueryParams<TDoc extends DocumentType> = {
  type: 'mustNot';
  innerQuery: DocumentTypeQueryParams[TDoc];
};
// Maps each document type to it's valid "nested" queries
type NestedDocumentsQueryParams = {
  [TDoc in keyof NestedDocumentTypesRelations]: {
    [Nested in keyof NestedDocumentTypesRelations[TDoc]]: NestedDocumentTypesRelations[TDoc][Nested] extends DocumentType
      ? GenerateTDocQueryParams<NestedDocumentTypesRelations[TDoc][Nested]>
      : never;
  };
};
// mapped type to bound P (path) to form valid innerQuery for each DocumentType, then indexed on [keyof NestedDocumentsQueryParams[TDoc]] so we get a union type
type GenerateNestedQueryParams<TDoc extends DocumentType> = {
  [P in keyof NestedDocumentsQueryParams[TDoc]]: {
    type: 'nested';
    path: P;
    innerQuery: NestedDocumentsQueryParams[TDoc][P];
  };
}[keyof NestedDocumentsQueryParams[TDoc]];

type GenerateQueryParams<TDoc extends DocumentType> =
  | ({ field: keyof DocumentTypeToDocument[TDoc]; parentPath?: string } & (
      | GenerateTermQueryParams
      | GenerateRangeQueryParams
      | GenerateQueryStringQuery
      | GenerateSimpleQueryStringQuery
    ))
  | GenerateMustNotQueryParams<TDoc>
  | GenerateNestedQueryParams<TDoc>;

const getFieldName = <T extends {}>(p: { field: keyof T; parentPath?: string }) => {
  const prefix = p.parentPath ? `${p.parentPath}.` : '';

  return `${prefix}${String(p.field)}`;
};

/** Utility function that creates a filter based on a more human-readable representation */
export const generateESQuery = <TDoc extends DocumentType>(
  p: DocumentTypeQueryParams[TDoc],
): QueryDslQueryContainer => {
  switch (p.type) {
    case 'term': {
      return {
        term: {
          [getFieldName(p)]: { value: p.term, boost: p.boost },
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
    case 'queryString': {
      return {
        query_string: {
          default_field: getFieldName(p),
          query: p.query,
          ...(p.boost && { boost: p.boost }),
        },
      };
    }
    case 'simpleQueryString': {
      return {
        simple_query_string: {
          fields: [getFieldName(p)],
          query: p.query,
          flags: 'FUZZY|NEAR|PHRASE|WHITESPACE',
          ...(p.boost && { boost: p.boost }),
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

type SearchPagination = {
  pagination: {
    limit: number;
    start: number;
  };
};

type SearchParametersContact = {
  type: DocumentType.Contact;
  searchTerm: string;
  searchFilters: QueryDslQueryContainer[];
  permissionFilters: {
    contactFilters: QueryDslQueryContainer[][];
    transcriptFilters: QueryDslQueryContainer[][];
  };
} & SearchPagination;

const generateQueriesFromId = <TDoc extends DocumentType>({
  searchTerm,
  documentType,
  parentPath,
  boostFactor,
  queryWrapper = p => p,
}: {
  searchTerm: string;
  boostFactor: number;
  queryWrapper?: (
    p: DocumentTypeQueryParams[DocumentType],
  ) => DocumentTypeQueryParams[DocumentType];
} & {
  documentType: TDoc;
  parentPath?: string;
}): QueryDslQueryContainer[] => {
  const terms = searchTerm.split(' ');

  if (terms.length > 1) {
    return [];
  }

  const parsed = Number.parseInt(searchTerm, 10);
  // Ignore terms that are not entirely a number or greater than max int, as that breaks term queries against integer fields
  if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed > MAX_INT) {
    return [];
  }

  return [
    generateESQuery(
      queryWrapper({
        documentType,
        type: 'term',
        term: parsed,
        boost: boostFactor * BOOST_FACTORS.id,
        field: 'id' as any, // typecast to conform TS, only valid parameters should be accept
        parentPath,
      }),
    ),
  ];
};

const generateQueryFromSearchTerms = <TDoc extends DocumentType>({
  searchTerm,
  documentType,
  field,
  parentPath,
  boostFactor,
  queryWrapper = p => p,
}: {
  searchTerm: string;
  boostFactor: number;
  queryWrapper?: (
    p: DocumentTypeQueryParams[DocumentType],
  ) => DocumentTypeQueryParams[DocumentType];
} & {
  documentType: TDoc;
  field: keyof DocumentTypeToDocument[TDoc];
  parentPath?: string;
}): QueryDslQueryContainer => {
  const query = generateESQuery(
    queryWrapper({
      documentType,
      type: 'simpleQueryString',
      query: searchTerm,
      boost: boostFactor,
      field: field as any, // typecast to conform TS, only valid parameters should be accept
      parentPath,
    }),
  );

  return query;
};

const generateTranscriptQueriesFromFilters = ({
  transcriptFilters,
  searchParameters,
  buildParams = { parentPath: '' },
  queryWrapper = p => p,
}: {
  transcriptFilters: QueryDslQueryContainer[][];
  searchParameters: SearchParametersContact;
  buildParams?: { parentPath: string };
  queryWrapper?: (
    p: DocumentTypeQueryParams[DocumentType],
  ) => DocumentTypeQueryParams[DocumentType];
}): QueryDslQueryContainer[] => {
  const query = generateQueryFromSearchTerms({
    documentType: DocumentType.Contact,
    field: 'transcript',
    searchTerm: searchParameters.searchTerm,
    parentPath: buildParams.parentPath,
    boostFactor: BOOST_FACTORS.transcript,
    queryWrapper,
  });

  return transcriptFilters.map(filter => ({
    bool: {
      filter: filter,
      should: {
        bool: { must: [query] },
      },
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
  queryWrapper?: (
    p: DocumentTypeQueryParams[DocumentType],
  ) => DocumentTypeQueryParams[DocumentType];
}): QueryDslQueryContainer[] => {
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
  });

  const queries = [
    generateQueryFromSearchTerms({
      documentType: DocumentType.Contact,
      field: 'content',
      searchTerm: searchParameters.searchTerm,
      parentPath: buildParams.parentPath,
      boostFactor: BOOST_FACTORS.contact,
      queryWrapper,
    }),
    ...generateQueriesFromId({
      documentType: DocumentType.Contact,
      searchTerm: searchParameters.searchTerm,
      parentPath: buildParams.parentPath,
      boostFactor: BOOST_FACTORS.contact,
      queryWrapper,
    }),
  ];

  const contactQueries = permissionFilters.contactFilters.map(contactFilter => ({
    bool: {
      filter: [...contactFilter, ...searchFilters],
      should: [
        ...queries.map(q => ({
          bool: { must: [q] },
        })),
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
    sort:
      searchParameters.searchTerm.length === 0
        ? [{ timeOfContact: 'desc' }]
        : ['_score', { timeOfContact: 'desc' }],
    min_score: MIN_SCORE,
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
  type: DocumentType.Case;
  searchTerm: string;
  searchFilters: QueryDslQueryContainer[];
  permissionFilters: {
    contactFilters: QueryDslQueryContainer[][];
    transcriptFilters: QueryDslQueryContainer[][];
    caseFilters: QueryDslQueryContainer[][];
  };
} & SearchPagination;

const generateCasesQueriesFromFilters = ({
  searchParameters,
}: {
  searchParameters: SearchParametersCases;
}): QueryDslQueryContainer[] => {
  const { searchFilters, permissionFilters } = searchParameters;

  if (searchParameters.searchTerm.length === 0) {
    return permissionFilters.caseFilters.map(caseFilter => ({
      bool: {
        filter: [...caseFilter, ...searchFilters],
        should: MATCH_ALL_CLAUSE,
      },
    }));
  }

  const contactsQueries = generateContactsQueriesFromFilters({
    searchParameters: { ...searchParameters, type: DocumentType.Contact },
    queryWrapper: p => ({
      documentType: DocumentType.Case,
      type: 'nested',
      path: casePathToContacts,
      innerQuery: p as DocumentTypeQueryParams[DocumentType.Contact], // typecast to conform TS, only valid parameters should be accept
    }),
    buildParams: { parentPath: casePathToContacts },
  });

  const queries = [
    generateQueryFromSearchTerms({
      documentType: DocumentType.Case,
      field: 'content',
      searchTerm: searchParameters.searchTerm,
      boostFactor: BOOST_FACTORS.case,
    }),
    ...generateQueriesFromId({
      documentType: DocumentType.Case,
      searchTerm: searchParameters.searchTerm,
      boostFactor: BOOST_FACTORS.case,
    }),
  ];

  const sectionsQuery = generateQueryFromSearchTerms({
    documentType: DocumentType.CaseSection,
    field: 'content',
    searchTerm: searchParameters.searchTerm,
    boostFactor: BOOST_FACTORS.case,
    queryWrapper: p => ({
      documentType: DocumentType.Case,
      type: 'nested',
      path: casePathToSections,
      innerQuery: p as DocumentTypeQueryParams[DocumentType.CaseSection], // typecast to conform TS, only valid parameters should be accept
    }),
    parentPath: casePathToSections,
  });

  const caseQueries = permissionFilters.caseFilters.map(caseFilter => ({
    bool: {
      filter: [...caseFilter, ...searchFilters],
      should: [
        ...queries.map(q => ({
          bool: { must: [q] },
        })),
        {
          bool: { must: [sectionsQuery] },
        },
        ...contactsQueries,
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
    sort:
      searchParameters.searchTerm.length === 0
        ? [{ createdAt: 'desc' }]
        : ['_score', { createdAt: 'desc' }],
    min_score: MIN_SCORE,
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
  isValidSearchParams(p, DocumentType.Contact);

const isSearchParametersCases = (p: any): p is SearchParametersCases =>
  isValidSearchParams(p, DocumentType.Case);

export const generateElasticsearchQuery = (p: GenerateIndexQueryParams): SearchQuery => {
  const { index, searchParameters } = p;

  const sanitizedTerm = searchParameters.searchTerm.trim();

  const sanitized = { ...searchParameters, searchTerm: sanitizedTerm };

  if (isHrmContactsIndex(index) && isSearchParametersContacts(sanitized)) {
    return generateContactsQuery({ index, searchParameters: sanitized });
  }

  if (isHrmCasesIndex(index) && isSearchParametersCases(sanitized)) {
    return generateCasesQuery({ index, searchParameters: sanitized });
  }

  throw new Error(
    `generateElasticsearchQuery not implemented for index ${p.index} - searchParameters type ${p.searchParameters.type} `,
  );
};
