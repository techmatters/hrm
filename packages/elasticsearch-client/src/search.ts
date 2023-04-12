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
 */
const getTotalValue = (total: number | SearchTotalHits | undefined): number => {
  if (typeof total === 'object') return total.value;

  return total || 0;
};

// TODO: this doesn't support range filters yet
export const generateFilters = (filters: SearchParameters['filters']): SearchQueryFilters => {
  const returnFilters: SearchQueryFilters = [];

  if (!filters?.length) return returnFilters;

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

  const searchConfig = await getConfig({
    configId,
    indexType,
    configType: 'search',
  });

  const query = generateElasticsearchQuery(accountSid, searchParameters, searchConfig.fields);

  console.log('query', query);

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
