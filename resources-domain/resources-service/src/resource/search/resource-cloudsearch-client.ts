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
  CloudSearchDomainClient,
  SearchCommand,
  SearchCommandOutput,
} from '@aws-sdk/client-cloudsearch-domain';
// eslint-disable-next-line prettier/prettier
import type { CloudSearchConfig } from '../../config/cloud-search';
import { TermsAndFilters } from './search-types';
import { AccountSID } from '@tech-matters/types';

type SearchResultItem = {
  id: string;
  name?: string;
  highlights: Record<string, string>;
};

export type SearchResultSet = {
  total: number;
  items: SearchResultItem[];
};

const EMPTY_RESULT = { total: 0, items: [] };

const client = (domainConfig: CloudSearchConfig) => {
  const domainClient: CloudSearchDomainClient = new CloudSearchDomainClient({
    endpoint: domainConfig.searchUrl.toString(),
  });

  return {
    search: async (
      accountSid: AccountSID,
      { searchTermsByIndex }: TermsAndFilters,
      start: number,
      limit: number,
    ): Promise<SearchResultSet> => {
      // I'm a little concerned about how well sanitised this is. It might be possible to inject something
      // However, since the query only returns names & IDs, and all we do is use the ID to look up from the DB...
      // I'm not sure how much damage anyone could do by injecting something, beyond giving themselves an error message.
      const queryClauses = Object.entries(searchTermsByIndex).flatMap(
        ([index, { phrases, terms, weighting }]) => {
          const phraseClauses = phrases.map(p => `(phrase field='${index}' boost=${weighting} '${p.replace(/'/g, `\\'`)}')`);
          if (terms.length) {
            return [
              ...phraseClauses,
              `(term field='${index}' boost=${weighting} '${terms.map(t=>t.replace(/'/g, `\\'`)).join(' ')}')`,
            ];
          }
          return phraseClauses;
        },
      );

      const query = `(or ${queryClauses.join('')})`;
      console.debug('searchResourcesDomain query', query);

      const command = new SearchCommand({
        query,
        queryParser: 'structured',
        filterQuery: `account_sid:'${accountSid}'`,
        size: limit,
        start,
      });

      const { hits }: SearchCommandOutput = await domainClient.send(command);
      if (!hits) {
        return EMPTY_RESULT;
      }
      const total = hits.found;
      return {
        total: total ?? 0,
        items: (hits.hit ?? []).map(({ id, fields, highlights }) => ({
          id: id ?? '',
          name: ((fields ?? {}).name ?? [])[0],
          highlights: highlights ?? {},
        })),
      };
    },
  };
};
export default client;
