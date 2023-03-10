export type SearchParameters = {
  filters: Record<string, boolean | number | string | string[]>;
  omniSearchTerm: string;
  pagination: {
    limit: number;
    start: number;
  };
};

export type TermsAndFilters = {
  searchTermsByIndex: Record<string, { term: string; weighting: string }>;
  filters: Record<string, string | { value: string | boolean | number | Date; comparison: string }>;
};
