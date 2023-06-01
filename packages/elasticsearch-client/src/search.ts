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
  QueryDslQueryContainer,
  SearchRequest as ESSearchRequest,
  SearchTotalHits as ESSearchTotalHits,
} from '@elastic/elasticsearch/lib/api/types';
import { getQuerySearchFields, SearchConfiguration } from './config';
import { Client } from '@elastic/elasticsearch';

export type SearchQuery = ESSearchRequest;

export type SearchExtraParams = {
  searchParameters: SearchParameters;
};

export type SearchParams = SearchExtraParams & {
  index: string;
  searchConfig: SearchConfiguration;
  client: Client;
};

export type SearchParameters = {
  filters?: Record<string, boolean | number | string | string[]>;
  q: string;
  pagination?: {
    limit: number;
    start: number;
  };
};

export type SearchResponseItem = {
  id: string;
  highlights: Record<string, string[]> | undefined;
};

export type SearchResponse = {
  total: number;
  items: SearchResponseItem[];
};

export type SearchGenerateElasticsearchQueryParams = {
  index: string;
  searchParameters: SearchParameters;
};

type SearchTotalHits = ESSearchTotalHits;

/**
 * f track_total_hits is false, Elasticsearch returns an approximate count of the total
 * hits as a number in the total field. If track_total_hits is true, Elasticsearch returns
 * an object of type SearchTotalHits that provides more accurate information about the total
 * hits.
 *
 * For now we flatten the object and return the value. In the future we may want to use the
 * relation field to determine if we need to do a second search to get the exact count.
 *
 * @param total the total hits as returned by Elasticsearch
 * @returns the total hits as a number
 */
export const getTotalValue = (total: number | SearchTotalHits | undefined): number => {
  if (typeof total === 'object') return total.value;

  return total || 0;
};

type FilterValue = boolean | number | string | Date | string[];

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
  searchConfiguration: SearchConfiguration,
  filters: SearchParameters['filters'],
): { filterClauses: QueryDslQueryContainer[]; filterSearchClause?: QueryDslQueryContainer } => {
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
      filtersAsSearchTerms.push(...(Array.isArray(value) ? value : [value]));
    }
  });
  return {
    filterClauses,
    filterSearchClause:
      filtersAsSearchTerms.length === 0
        ? undefined
        : {
            multi_match: {
              query: filtersAsSearchTerms.join(' '),
              fields: getQuerySearchFields(searchConfiguration, 1), // boost up the terms specified as filters a little
              type: 'cross_fields',
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
export const generateElasticsearchQuery = (
  searchConfiguration: SearchConfiguration,
  { index, searchParameters }: SearchGenerateElasticsearchQueryParams,
): SearchQuery => {
  const { q, filters, pagination } = searchParameters;
  const queryClauses: QueryDslQueryContainer[] = [
    {
      simple_query_string: {
        query: q,
        fields: getQuerySearchFields(searchConfiguration),
      },
    },
  ];
  const filterPart: { filter?: QueryDslQueryContainer[] } = {};

  if (filters) {
    const { filterClauses, filterSearchClause } = generateFilters(searchConfiguration, filters);
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

/**
 * This function takes a SearchParameters object and returns a SearchResponseSearchResponse object that contains
 * the results of the search.
 **/
export const search = async ({
  client,
  index,
  searchConfig,
  searchParameters,
}: SearchParams): Promise<SearchResponse> => {
  const query = generateElasticsearchQuery(searchConfig, {
    index,
    searchParameters,
  });

  const { hits } = await client.search(query);
  const total = getTotalValue(hits.total);

  if (!total) return { total: 0, items: [] };

  return {
    total,
    items: hits.hits.map(hit => ({
      id: hit._id,
      highlights: hit.highlight,
    })),
  };
};

export default search;
