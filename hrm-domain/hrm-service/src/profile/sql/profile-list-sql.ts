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

import { pgp } from '../../connection-pool';
import { OrderByClauseItem, OrderByDirection } from '../../sql';

export const OrderByColumn = {
  ID: 'id',
  NAME: 'name',
} as const;

export type OrderByColumnType = (typeof OrderByColumn)[keyof typeof OrderByColumn];

const ORDER_BY_FIELDS: Record<OrderByColumnType, string> = {
  id: pgp.as.name('id'),
  name: pgp.as.name('name'),
} as const;

const DEFAULT_SORT: OrderByClauseItem[] = [
  { sortBy: 'id', sortDirection: OrderByDirection.descending },
];

const generateOrderByClause = (clauses: OrderByClauseItem[]): string => {
  const validClauses = clauses.filter(c => ORDER_BY_FIELDS[c.sortBy]);
  if (clauses.length > 0) {
    return ` ORDER BY ${validClauses
      .map(t => `${ORDER_BY_FIELDS[t.sortBy]} ${t.sortDirection}`)
      .join(', ')}`;
  } else return '';
};

const selectProfilesUnorderedSql = (whereClause: string) => `
  SELECT (count(*) OVER())::INTEGER AS "totalCount", *
  FROM "Profiles" profiles
  ${whereClause}
`;

const listProfilesPaginatedSql = (whereClause: string, orderByClause: string) => `
  WITH TargetProfiles AS (
    ${selectProfilesUnorderedSql(whereClause)}
    ${orderByClause}
    OFFSET $<offset>
    LIMIT $<limit>
  ),
  RelatedProfileFlags AS (
    SELECT
      ppf."profileId",
      JSONB_AGG(JSONB_BUILD_OBJECT('id', ppf."profileFlagId", 'validUntil', ppf."validUntil")) AS "profileFlags"
    FROM "ProfilesToProfileFlags" ppf
    WHERE ppf."profileId" IN (SELECT id FROM TargetProfiles)
    GROUP BY ppf."profileId"
  )
  SELECT "totalCount", profiles.id, profiles.name, identifiers.identifier, rpf."profileFlags", ps.content AS summary
  FROM TargetProfiles tp
  LEFT JOIN "Profiles" profiles ON profiles.id = tp.id AND profiles."accountSid" = tp."accountSid"
  LEFT JOIN "ProfilesToIdentifiers" p2i ON p2i."profileId" = profiles.id AND p2i."accountSid" = profiles."accountSid"
  LEFT JOIN "Identifiers" identifiers ON identifiers.id = p2i."identifierId"
  LEFT JOIN RelatedProfileFlags rpf ON rpf."profileId" = profiles.id
  LEFT JOIN "ProfileSections" ps ON ps."profileId" = profiles.id AND ps."accountSid" = profiles."accountSid" AND ps."sectionType" = 'summary'
  ${orderByClause};
`;

export type ProfilesListFilters = {
  profileFlagIds?: number[];
};

const filterSql = ({ profileFlagIds }: ProfilesListFilters) => {
  const filterSqlClauses: string[] = [];
  if (profileFlagIds && profileFlagIds.length) {
    filterSqlClauses.push(
      `profiles.id IN (SELECT "profileId" FROM "ProfilesToProfileFlags" WHERE "profileFlagId" IN ($<profileFlagIds:csv>))`,
    );
  }
  return filterSqlClauses.join(`
  AND `);
};

export type ListProfilesQueryBuilder = (
  filters: ProfilesListFilters,
  orderByClauses?: OrderByClauseItem[],
) => string;

const listProfilesBaseQuery = (whereClause: string): ListProfilesQueryBuilder => {
  return (filters, orderByClauses) => {
    const whereSql = [whereClause, filterSql(filters)].filter(sql => sql).join(`
    AND `);
    const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
    return listProfilesPaginatedSql(whereSql, orderBySql);
  };
};

export const listProfilesSql = listProfilesBaseQuery(`
  WHERE profiles."accountSid" = $<accountSid>
`);
