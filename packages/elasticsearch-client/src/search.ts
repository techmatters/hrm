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
  SearchRequest as ESSearchRequest,
  SearchTotalHits as ESSearchTotalHits,
} from '@elastic/elasticsearch/lib/api/types';
import { PassThroughConfig } from './client';

export type SearchQueryFilters = Array<
  | { terms: { [key: string]: string[] } }
  | { term: { [key: string]: string | boolean | number | Date } }
>;

export type SearchQuery = ESSearchRequest;

export type SearchExtraParams = {
  searchParameters: SearchParameters;
};

export type SearchParams = PassThroughConfig & SearchExtraParams;

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
  fields: string[];
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

/**
 * This function takes a SearchParameters.filters object and returns a SearchQueryFilters object
 * that can be used in the Elasticsearch query.
 *
 * @param filters the filters object from the SearchParameters
 * @returns the filters object to be used in the Elasticsearch query
 */
export const generateFilters = (filters: SearchParameters['filters']): SearchQueryFilters => {
  // TODO: this doesn't support range filters yet
  // TODO: should we validate request filters against the index config?
  const returnFilters: SearchQueryFilters = [];

  if (!filters || Object.keys(filters).length === 0) return returnFilters;

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      returnFilters.push({
        terms: {
          [key]: value,
        },
      });
    } else {
      returnFilters.push({
        term: {
          [key as string]: value,
        },
      });
    }
  });

  return returnFilters;
};

/**
 * This function takes a SearchParameters object and returns a SearchQuery object that can be
 * used to query Elasticsearch.
 *
 * @param index the the index to search
 * @param searchParameters the search parameters
 * @param fields the fields to search
 * @returns the SearchQuery object
 */
export const generateElasticsearchQuery = ({
  index,
  searchParameters,
  fields,
}: SearchGenerateElasticsearchQueryParams): SearchQuery => {
  const { q, filters, pagination } = searchParameters;

  const query: SearchQuery = {
    index,
    query: {
      bool: {
        must: [
          {
            query_string: {
              query: q,
              fields,
            },
          },
        ],
      },
    },
  };

  if (pagination?.limit) {
    query.size = pagination.limit;
  }
  if (pagination?.start) {
    query.from = pagination.start;
  }

  if (filters) {
    query.query!.bool!.filter = generateFilters(filters);
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
  indexConfig,
  searchParameters,
}: SearchParams): Promise<SearchResponse> => {
  const query = generateElasticsearchQuery({
    index,
    searchParameters,
    fields: indexConfig.searchFields,
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
