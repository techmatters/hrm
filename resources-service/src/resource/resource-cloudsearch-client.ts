import { TermsAndFilters } from './search-types';
import cloudSearchConfig from '../config/cloud-search';

type SearchResultItem = {
  id: string;
  context: string;
};

type SearchResultSet = {
  total: number;
  items: SearchResultItem[];
};

export const searchResourcesDomain = async (
  { searchTermsByIndex, filters }: TermsAndFilters,
  start: number,
  limit: number,
): Promise<SearchResultSet> => {
  console.debug(
    'runResourceSearch',
    { searchTermsByIndex, filters, start, limit },
    cloudSearchConfig.url,
  );
  return {
    total: start + limit,
    items: [
      {
        id: '1',
        context: 'context 1',
      },
      {
        id: '2',
        context: 'context 2',
      },
    ],
  };
};
