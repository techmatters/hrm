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

import { AccountSID } from '@tech-matters/twilio-worker-auth';
import { getClient } from '@tech-matters/elasticsearch-client';
import { SearchQuery } from './search-types';

interface SearchTotalHits {
  value: number;
  relation: 'eq' | 'gte';
}

type SearchResultItem = {
  id: string;
  highlights: Record<string, string[]> | undefined;
};

export type SearchResultSet = {
  total: number;
  items: SearchResultItem[];
};

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

const client = {
  search: async (accountSid: AccountSID, query: SearchQuery): Promise<SearchResultSet> => {
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
  },
};

export default client;
