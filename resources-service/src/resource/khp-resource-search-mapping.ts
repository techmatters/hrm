import { SearchParameters, TermsAndFilters } from './search-types';

export const mapSearchParametersToKhpTermsAndFilters = ({
  omniSearchTerm,
  filters,
}: SearchParameters): TermsAndFilters => {
  const everything = `${omniSearchTerm} ${Object.values(filters).join(' ')}`;
  return {
    searchTermsByIndex: {
      search_terms_en_1: { term: everything, weighting: '1' },
      name: { term: everything, weighting: '2' },
    },
    filters: {},
  };
};
