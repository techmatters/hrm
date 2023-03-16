import {
  CloudSearchDomainClient,
  SearchCommand,
  SearchCommandOutput,
} from '@aws-sdk/client-cloudsearch-domain';
import cloudSearchConfig from '../../config/cloud-search';
import { TermsAndFilters } from './search-types';

type SearchResultItem = {
  id: string;
  name?: string;
  highlights: Record<string, string>;
};

type SearchResultSet = {
  total: number;
  items: SearchResultItem[];
};

const domainConfig = cloudSearchConfig();

const client: CloudSearchDomainClient = new CloudSearchDomainClient({
  endpoint: domainConfig.searchUrl,
});

export const searchResourcesDomain = async (
  { searchTermsByIndex }: TermsAndFilters,
  start: number,
  limit: number,
): Promise<SearchResultSet> => {
  const queryClauses = Object.entries(searchTermsByIndex).map(
    ([index, { phrases, weighting }]) =>
      `(phrase field='${index}' boost=${weighting} ${phrases.map(p => `'${p}'`)})`,
  );

  const query = `(or ${queryClauses.join('')})`;
  console.debug('searchResourcesDomain query', query);

  const command = new SearchCommand({
    query,
    queryParser: 'structured',
    size: limit,
    start,
  });

  const { hits }: SearchCommandOutput = await client.send(command);
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
};
