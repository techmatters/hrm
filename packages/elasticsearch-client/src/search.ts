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
  SearchParameters,
  SearchQuery,
  SearchQueryFilters,
  SearchResults,
} from '@tech-matters/types';

import { getClient } from './client';
import getConfig from './get-config';

import getAccountSid from './get-account-sid';

interface SearchTotalHits {
  value: number;
  relation: 'eq' | 'gte';
}

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
const getTotalValue = (total: number | SearchTotalHits | undefined): number => {
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
 * @param accountSid the account sid
 * @param searchParameters the search parameters
 * @param fields the fields to search
 * @returns the SearchQuery object
 */
export const generateElasticsearchQuery = (
  accountSid: string,
  searchParameters: SearchParameters,
  fields: string[],
) => {
  const { q, filters, pagination } = searchParameters;
  const { limit, start } = pagination;

  const query: SearchQuery = {
    index: `${accountSid.toLowerCase()}-resources`,
    body: {
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
      from: start,
      size: limit,
    },
  };

  if (filters) {
    query.body.query.bool.filter = generateFilters(filters);
  }

  return query;
};

/**
 * This function takes a SearchParameters object and returns a SearchResults object that contains
 * the results of the search.
 **/
export const search = async ({
  accountSid,
  configId = 'default',
  indexType,
  shortCode,
  searchParameters,
}: {
  accountSid?: string;
  configId?: string;
  indexType: string;
  shortCode?: string;
  searchParameters: SearchParameters;
}): Promise<SearchResults> => {
  if (!accountSid) {
    accountSid = await getAccountSid(shortCode!);
  }

  const config = await getConfig({
    configId,
    indexType,
  });
  const query = generateElasticsearchQuery(accountSid, searchParameters, config.searchFields);
  const esClient = await getClient({ accountSid });
  const { hits } = await esClient.search(query);
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
