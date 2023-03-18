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

import { SearchParameters, TermsAndFilters } from './search-types';

/*
This pattern matches individual words outside double quotes, or phrases enclosed in double quotes (without the quotes included in the match).
 */
const parseSearchTermRegex = /(?<phrase>(?<=")[^"]*(?="))|(?<term>\b[\S]+\b)/g;

export const mapSearchParametersToKhpTermsAndFilters = ({
  generalSearchTerm,
  filters,
}: SearchParameters): TermsAndFilters => {
  const matches = Array.from(generalSearchTerm.matchAll(parseSearchTermRegex) ?? []);
  const phrases = matches.filter(m => m.groups!.phrase).map(m => m.groups!.phrase);
  const terms = matches.filter(m => m.groups!.term).map(m => m.groups!.term);
  const allPhrases = [
    ...phrases,
    ...Object.values(filters ?? {}).filter(f => f !== undefined && typeof f === 'string'),
  ] as string[];
  const nameTerm: TermsAndFilters['searchTermsByIndex'] =
    phrases.length || terms.length ? { name: { terms, phrases, weighting: 3 } } : {};
  const everthingElseTerm: TermsAndFilters['searchTermsByIndex'] =
    allPhrases.length || terms.length
      ? {
          search_terms_en_1: { terms, phrases: allPhrases, weighting: 2 },
          search_terms_en_2: { terms, phrases: allPhrases, weighting: 1 },
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
