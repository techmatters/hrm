import {
  CloudSearchDomainClient,
  SearchCommand,
  SearchCommandOutput,
} from '@aws-sdk/client-cloudsearch-domain';
// eslint-disable-next-line prettier/prettier
import type { CloudSearchConfig } from '../../config/cloud-search';
import { TermsAndFilters } from './search-types';
import { AccountSID } from '@tech-matters/twilio-worker-auth';

type SearchResultItem = {
  id: string;
  name?: string;
  highlights: Record<string, string>;
};

type SearchResultSet = {
  total: number;
  items: SearchResultItem[];
};

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
      const queryClauses = Object.entries(searchTermsByIndex).map(
        ([index, { phrases, weighting }]) =>
          `(phrase field='${index}' boost=${weighting} ${phrases.map(p => `'${p.replace(/'/g, `\\'`)}'`).join(' ')})`,
      );

      const query = `(or ${queryClauses.join('')})`;
      console.debug('searchResourcesDomain query', query);

      const command = new SearchCommand({
        query,
        queryParser: 'structured',
        filterQuery: `account_sid:${accountSid}`,
        size: limit,
        start,
      });

      const { hits }: SearchCommandOutput = await domainClient.send(command);
      if (!hits) {
        return { total: 0, items: [] };
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
