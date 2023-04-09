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

export type SearchParameters = {
  filters?: Record<string, boolean | number | string | string[]>;
  generalSearchTerm: string;
  pagination: {
    limit: number;
    start: number;
  };
};

export type TermsAndFilters = {
  searchTermsByIndex: Record<string, { phrases: string[]; terms: string[]; weighting: number }>;
  filters: Record<string, string | { value: string | boolean | number | Date; comparison: string }>;
};

export type SearchParametersEs = {
  filters?: Record<string, boolean | number | string | string[]>;
  q: string;
  pagination: {
    limit: number;
    start: number;
  };
};

export type SearchQueryFilters = Array<
  | { terms: { [key: string]: string[] } }
  | { term: { [key: string]: string | boolean | number | Date } }
>;

export type SearchQuery = {
  index: string;
  body: {
    query: {
      bool: {
        filter?: SearchQueryFilters;
        must: Array<{ query_string: { query: string; fields: string[] } }>;
      };
    };
    from: number;
    size: number;
  };
};
