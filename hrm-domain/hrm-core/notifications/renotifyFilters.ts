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

import createError from 'http-errors';

/**
 * Narrows down which entities a manually triggered notification operation (reindex, republish, reexport) applies to.
 * Missing dates leave that end of the range open. If ids are given, only those entities are renotified.
 */
export type RenotifyFilters = {
  dateFrom?: string;
  dateTo?: string;
  ids?: string[];
};

const isEntityId = (id: unknown) =>
  (typeof id === 'string' || typeof id === 'number') && /^\d+$/.test(String(id));

/**
 * Reads the renotify filters from an admin request body, rejecting the request if ids is not a list of numeric ids.
 */
export const parseRenotifyFilters = ({
  dateFrom,
  dateTo,
  ids,
}: Record<string, unknown>): RenotifyFilters => {
  if (ids !== undefined && !(Array.isArray(ids) && ids.every(isEntityId))) {
    throw createError(400, 'ids must be a list of numeric entity ids');
  }
  return {
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    ids: (ids as unknown[] | undefined)?.map(String),
  };
};
