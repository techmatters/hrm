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

/**
 * Used if you need to alias a text filter in the API to a different field in the index.
 */
type TermFilterMapping = {
  type: 'term';
  targetField?: string;
};

const rangeFilterOperators = ['gt', 'gte', 'lt', 'lte'] as const;
export type RangeFilterOperator = typeof rangeFilterOperators[number];

/**
 * Used to specify an incoming filter as a range filter.
 * If no mapping is specified for
 */
type RangeFilterMapping = {
  type: 'range';
  targetField?: string;
  operator: RangeFilterOperator;
};

type FilterMapping = TermFilterMapping | RangeFilterMapping;

export type SearchConfiguration = {
  searchFieldBoosts: Record<string, number>;
  filterMappings: Record<string, FilterMapping>;
};

export const getQuerySearchFields = (
  searchConfiguration: SearchConfiguration,
  boostAdjustment = 0,
): string[] =>
  Object.entries(searchConfiguration.searchFieldBoosts).map(
    ([field, boost]) => `${field}^${boost + boostAdjustment}`,
  );
