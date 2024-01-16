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

const isLimitAndOffsetParam = param => Object.keys(param).includes('offset');

/**
 * This function takes care of keep calling the search function
 * until there's no more data to be fetched. It works by dynamically
 * adjusting the 'offset' on each subsequent call.
 *
 * @param searchFunction searchCases or searchContacts
 * @param params params for searchCases or searchContacts
 * @returns cases[] or contacts[]
 */
export const autoPaginate = async <T extends (...args: any) => any>(
  searchFunction: T,
  params: Parameters<T>,
) => {
  let items = [];
  let hasMoreItems = true;
  let offset = Number(defaultLimitAndOffset.offset);
  const limit = Number(defaultLimitAndOffset.limit);

  while (hasMoreItems) {
    const updatedLimitAndOffset = { limit: limit.toString(), offset: offset.toString() };

    /**
     * Updates 'limitAndOffset' param
     * Keep the other params intact
     */
    const updatedParams = params.map(param =>
      isLimitAndOffsetParam(param) ? updatedLimitAndOffset : param,
    );
    const searchResult = await searchFunction(...updatedParams);

    const { count, cases, contacts } = searchResult;
    const currentItems = cases ?? contacts;
    items = [...items, ...currentItems];

    hasMoreItems = items.length < count;

    if (hasMoreItems) {
      offset += limit;
    }
  }

  return items;
};
