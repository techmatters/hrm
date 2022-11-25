import { OrderByDirection } from './sql';

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
