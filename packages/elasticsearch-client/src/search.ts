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
import { Client } from '@elastic/elasticsearch';
import { SearchConfiguration } from './config';

export type SearchQuery = ESSearchRequest;

export type SearchExtraParams<T> = {
  searchParameters: T;
};

export type SearchParams<T> = SearchExtraParams<T> & {
  index: string;
  client: Client;
  searchConfig: SearchConfiguration<T>;
};

export type SearchResponseItem = {
  id: string;
  name?: string;
  highlights: Record<string, string[]> | undefined;
};

export type SearchResponse = {
  total: number;
  items: SearchResponseItem[];
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
 * This function takes a SearchParameters object and returns a SearchResponseSearchResponse object that contains
 * the results of the search.
 **/
export const search = async <T>({
  client,
  index,
  searchConfig,
  searchParameters,
}: SearchParams<T>): Promise<SearchResponse> => {
  const query = searchConfig.generateElasticsearchQuery({
    index,
    searchParameters,
  });
  console.debug('search query', JSON.stringify(query, null, 2));

  const { hits } = await client.search(query);
  const total = getTotalValue(hits.total);

  if (!total) return { total: 0, items: [] };

  return {
    total,
    items: hits.hits.map(hit => ({
      id: hit._id,
      name: hit.fields?.name,
      highlights: hit.highlight,
    })),
  };
};

export default search;
