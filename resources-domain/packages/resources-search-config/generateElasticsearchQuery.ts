import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { SearchQuery } from '@tech-matters/elasticsearch-client';
import {
  ResourcesSearchConfiguration,
  getQuerySearchFields,
} from './searchConfiguration';

type FilterValue = boolean | number | string | Date | string[];

export type SearchParameters = {
  filters?: Record<string, boolean | number | string | string[]>;
  q: string;
  pagination?: {
    limit: number;
    start: number;
  };
};

export type SearchGenerateElasticsearchQueryParams = {
  index: string;
  searchParameters: SearchParameters;
};

const toPhrase = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

const generateTermFilter = (field: string, filterValue: FilterValue) => {
  if (Array.isArray(filterValue)) {
    return {
      terms: {
        [field]: filterValue,
      },
    };
  } else {
    return {
      term: {
        [field as string]: filterValue,
      },
    };
  }
};
/**
 * This function takes a SearchParameters.filters object and returns a SearchQueryFilters object
 * that can be used in the Elasticsearch query.
 *
 * @param searchConfiguration - contains mappings and searchFields used to generate the query correctly
 * @param filters the filters object from the SearchParameters
 * @returns the filters object to be used in the Elasticsearch query
 */
const generateFilters = (
  searchConfiguration: ResourcesSearchConfiguration,
  filters: SearchParameters['filters'],
): {
  filterClauses: QueryDslQueryContainer[];
  filterSearchClause?: QueryDslQueryContainer;
} => {
  // TODO: should we validate request filters against the index config?
  // Currently doesn't support:
  // - nested fields
  // - fancy date range filters like time zones or relative ranges
  // - range filters with multiple clauses
  // Implement as required!

  const filterClauses: QueryDslQueryContainer[] = [];
  const filtersAsSearchTerms: string[] = [];
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    const mapping = searchConfiguration.filterMappings[key];
    const targetField = mapping?.targetField ?? key;
    if (mapping) {
      switch (mapping.type) {
        case 'range':
          if (!Array.isArray(value)) {
            filterClauses.push({
              range: {
                [targetField]: {
                  [mapping.operator]: value,
                },
              },
            });
          } else {
            console.warn(
              `Array filter values not supported for range filters: ${key}, mapped to ${mapping.targetField}, values: ${value}. Treating as a term filter.`,
            );
          }
          break;
        case 'term':
          filterClauses.push(generateTermFilter(targetField, value));
          break;
      }
    } else if (!Array.isArray(value) && typeof value !== 'string') {
      // If there is no explicit mapping, but it isn't a string or a string array, still treat it as a term filter
      filterClauses.push(generateTermFilter(targetField, value));
    } else {
      // Otherwise add to the bucket of high priority additional search terms
      const terms = Array.isArray(value) ? value : [value];
      const clause = terms.map(toPhrase).join(' | ');
      filtersAsSearchTerms.push(terms.length > 1 ? `(${clause})` : clause);
    }
  });
  return {
    filterClauses,
    filterSearchClause:
      filtersAsSearchTerms.length === 0
        ? undefined
        : {
            simple_query_string: {
              query: filtersAsSearchTerms.join(' '),
              fields: getQuerySearchFields(searchConfiguration, 1), // boost up the terms specified as filters a little
              default_operator: 'AND',
            },
          },
  };
};

/**
 * This function takes a SearchParameters object and returns a SearchQuery object that can be
 * used to query Elasticsearch.
 *
 * @param searchConfiguration - contains filter mappings and search field configuration used to generate the query correctly
 * @param index the the index to search
 * @param searchParameters the search parameters
 * @returns the SearchQuery object
 */
export const generateElasticsearchQuery =
  (searchConfiguration: ResourcesSearchConfiguration) =>
  ({ index, searchParameters }: SearchGenerateElasticsearchQueryParams): SearchQuery => {
    const { q, filters, pagination } = searchParameters;
    const queryClauses: QueryDslQueryContainer[] = [
      q
        ? {
            simple_query_string: {
              query: q,
              fields: getQuerySearchFields(searchConfiguration),
            },
          }
        : {
            match_all: {},
          },
    ];
    const filterPart: { filter?: QueryDslQueryContainer[] } = {};

    if (filters) {
      const { filterClauses, filterSearchClause } = generateFilters(
        searchConfiguration,
        filters,
      );
      if (filterClauses.length > 0) {
        filterPart.filter = filterClauses;
      }
      if (filterSearchClause) {
        queryClauses.push(filterSearchClause);
      }
    }

    const query: SearchQuery = {
      index,
      query: {
        bool: {
          must: queryClauses,
          ...filterPart,
        },
      },
    };

    if (pagination?.limit) {
      query.size = pagination.limit;
    }
    if (pagination?.start) {
      query.from = pagination.start;
    }

    return query;
  };
