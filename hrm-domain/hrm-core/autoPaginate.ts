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

export const defaultLimitAndOffset = {
  limit: '1000', // The underlying query limits this value to 1000.
  offset: '0',
};

type SearchResult<T> = {
  count: number;
  records: T[];
};

type LimitAndOffset = {
  limit: number;
  offset: number;
};

/**
 * This function takes care of keep calling the search function
 * until there's no more data to be fetched. It works by dynamically
 * adjusting the 'offset' on each subsequent call.
 *
 * @param searchFunction function to perform search of cases or contacts with the provided limit & offset
 * @returns cases[] or contacts[]
 */
export const autoPaginate = async <T>(
  searchFunction: (limitAndOffset: LimitAndOffset) => Promise<SearchResult<T>>,
): Promise<T[]> => {
  let items: T[] = [];
  let hasMoreItems = true;
  let offset = Number(defaultLimitAndOffset.offset);
  const limit = Number(defaultLimitAndOffset.limit);

  while (hasMoreItems) {
    /**
     * Updates 'limitAndOffset' param
     * Keep the other params intact
     */
    const searchResult = await searchFunction({ limit, offset });

    const { count, records } = searchResult;
    items = [...items, ...records];

    hasMoreItems = items.length < count;

    if (hasMoreItems) {
      offset += limit;
    }
  }

  return items;
};
