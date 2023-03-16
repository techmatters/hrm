import { SearchParameters, TermsAndFilters } from './search-types';

/*
This pattern matches individual words outside double quotes, or phrases enclosed in double quotes (without the quotes.
 */
const parseSearchTermRegex = /(?<=")[^"]*(?=")|\b[\S]+\b/g;

export const mapSearchParametersToKhpTermsAndFilters = ({
  omniSearchTerm,
  filters,
}: SearchParameters): TermsAndFilters => {
  const phrases = omniSearchTerm.match(parseSearchTermRegex) ?? [];
  const everything = [
    ...phrases,
    ...Object.values(filters ?? {}).filter(f => f !== undefined && typeof f === 'string'),
  ] as string[];
  const nameTerm: TermsAndFilters['searchTermsByIndex'] = phrases.length
    ? { name: { phrases, weighting: 3 } }
    : {};
  const everthingElseTerm: TermsAndFilters['searchTermsByIndex'] = everything.length
    ? {
        search_terms_en_1: { phrases: everything, weighting: 2 },
        search_terms_en_2: { phrases: everything, weighting: 1 },
      }
    : {};
  return {
    searchTermsByIndex: {
      ...nameTerm,
      ...everthingElseTerm,
    },
    filters: {},
  };
};
