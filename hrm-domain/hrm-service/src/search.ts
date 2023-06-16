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

import { OrderByDirection } from '@tech-matters/sql';

export type PaginationQuery = {
  limit?: string;
  offset?: string;
  sortBy?: string;
  sortDirection?: string;
};

export const getPaginationElements = (query: PaginationQuery) => {
  const queryLimit =
    query.limit && !Number.isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : Infinity;
  const limit = Math.min(queryLimit, 1000);
  const offset = (query.offset && parseInt(query.offset, 10)) || 0;
  const sortBy = query.sortBy || 'id';
  const sortDirection =
    (query.sortDirection ?? 'desc').toLowerCase() === 'asc'
      ? OrderByDirection.ascendingNullsLast
      : OrderByDirection.descendingNullsLast;

  return { limit, offset, sortBy, sortDirection };
};
