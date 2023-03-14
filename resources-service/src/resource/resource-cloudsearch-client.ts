import {
  CloudSearchDomainClient,
  SearchCommand,
  SearchCommandOutput,
} from '@aws-sdk/client-cloudsearch-domain';
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

const client: CloudSearchDomainClient = new CloudSearchDomainClient({});

export const searchResourcesDomain = async (
  { searchTermsByIndex, filters }: TermsAndFilters,
  start: number,
  limit: number,
): Promise<SearchResultSet> => {
  console.debug('searchResourcesDomain', { searchTermsByIndex, filters, start, limit });

  const queryClauses = Object.entries(searchTermsByIndex).map(
    ([index, { phrases, weighting }]) =>
      `(field='${index}' boost=${weighting} ${phrases.map(p => `'${p}'`)})`,
  );

  const command = new SearchCommand({ query: `(or ${queryClauses.join('')})` });
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
