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

import { pgp } from '../../dbConnection';
import { DateExistsCondition, DateFilter } from '../../sql';
import { CaseListFilters } from '../caseDataAccess';
import { OrderByClauseItem, OrderByDirection } from '../../sql';
import { selectContactsOwnedCount } from './caseGetSql';
import { CaseListCondition, listCasesPermissionWhereClause } from './casePermissionSql';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { TKConditionsSets } from '../../permissions/rulesMap';

export const OrderByColumn = {
  ID: 'id',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  CHILD_NAME: 'childName',
  FOLLOW_UP_DATE: 'info.followUpDate',
} as const;

export type OrderByColumnType = (typeof OrderByColumn)[keyof typeof OrderByColumn];

const ORDER_BY_FIELDS: Record<OrderByColumnType, string> = {
  id: pgp.as.name('id'),
  createdAt: pgp.as.name('createdAt'),
  updatedAt: pgp.as.name('updatedAt'),
  'info.followUpDate': `"info"->>'followUpDate'`,
  childName: pgp.as.name('childName'),
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

const enum FilterableDateField {
  CREATED_AT = 'cases."createdAt"::TIMESTAMP WITH TIME ZONE',
  UPDATED_AT = 'cases."updatedAt"::TIMESTAMP WITH TIME ZONE',
  FOLLOW_UP_DATE = `CAST(NULLIF(cases."info"->>'followUpDate', '') AS TIMESTAMP WITH TIME ZONE)`,
}

const dateFilterCondition = (
  field: FilterableDateField,
  filterName: string,
  filter: DateFilter,
): string | undefined => {
  let existsCondition: string | undefined;
  if (filter.exists === DateExistsCondition.MUST_EXIST) {
    existsCondition = `(${field} IS NOT NULL)`;
  } else if (filter.exists === DateExistsCondition.MUST_NOT_EXIST) {
    existsCondition = `(${field} IS NULL)`;
  }
  if (filter.to || filter.from) {
    filter.to = filter.to ?? null;
    filter.from = filter.from ?? null;
    return `(($<${filterName}.from> IS NULL OR ${field} >= $<${filterName}.from>::TIMESTAMP WITH TIME ZONE) 
            AND ($<${filterName}.to> IS NULL OR ${field} <= $<${filterName}.to>::TIMESTAMP WITH TIME ZONE)
            ${existsCondition ? ` AND ${existsCondition}` : ''})`;
  }
  return existsCondition;
};

const filterSql = ({
  counsellors,
  statuses,
  createdAt = {},
  updatedAt = {},
  followUpDate = {},
  helplines,
  excludedStatuses,
  includeOrphans,
  customFilter,
}: CaseListFilters) => {
  const filterSqlClauses: string[] = [];
  if (helplines && helplines.length) {
    filterSqlClauses.push(`cases."helpline" IN ($<helplines:csv>)`);
  }
  if (counsellors && counsellors.length) {
    filterSqlClauses.push(`cases."twilioWorkerId" IN ($<counsellors:csv>)`);
  }
  if (excludedStatuses && excludedStatuses.length) {
    filterSqlClauses.push(`cases."status" NOT IN ($<excludedStatuses:csv>)`);
  }
  if (statuses && statuses.length) {
    filterSqlClauses.push(`cases."status" IN ($<statuses:csv>)`);
  }
  if (customFilter) {
    Object.entries(customFilter).forEach(([key, values]) => {
      if (values && values.length) {
        filterSqlClauses.push(`cases."info"->>'${key}' IN ($<customFilter.${key}:csv>)`);
      }
    });
  }
  filterSqlClauses.push(
    ...[
      dateFilterCondition(FilterableDateField.CREATED_AT, 'createdAt', createdAt),
      dateFilterCondition(FilterableDateField.UPDATED_AT, 'updatedAt', updatedAt),
      dateFilterCondition(
        FilterableDateField.FOLLOW_UP_DATE,
        'followUpDate',
        followUpDate,
      ),
    ].filter(sql => sql),
  );
  if (!includeOrphans) {
    filterSqlClauses.push(`EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
      )`);
  }
  return filterSqlClauses.join(`
  AND `);
};

const nameAndPhoneNumberSearchSql = (
  firstNameSources: string[],
  lastNameSources: string[],
  phoneNumberColumns: string[],
) =>
  `CASE WHEN $<firstName> IS NULL THEN TRUE
        ELSE ${firstNameSources.map(fns => `${fns} ILIKE $<firstName>`).join('\n OR ')}
        END
      AND
        CASE WHEN $<lastName> IS NULL THEN TRUE
        ELSE ${lastNameSources.map(lns => `${lns} ILIKE $<lastName>`).join('\n OR ')}
        END
      AND
        CASE WHEN $<phoneNumber> IS NULL THEN TRUE
        ELSE (
          ${phoneNumberColumns
            .map(pn => `regexp_replace(${pn}, '\\D', '', 'g') ILIKE $<phoneNumber>`)
            .join('\n OR ')}
        )
        END`;

const SEARCH_WHERE_CLAUSE = `(
      -- search on childInformation of connectedContacts
      ($<firstName> IS NULL AND $<lastName> IS NULL AND $<phoneNumber> IS NULL) OR
      EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id  AND c."accountSid" = cases."accountSid"
          AND (
            (
            ${nameAndPhoneNumberSearchSql(
              ["c.\"rawJson\"->'childInformation'->>'firstName'"],
              ["c.\"rawJson\"->'childInformation'->>'lastName'"],
              [
                "c.\"rawJson\"->'childInformation'->'location'->>'phone1'",
                "c.\"rawJson\"->'childInformation'->'location'->>'phone2'",
                'c.number',
              ],
            )})
            -- search on callerInformation of connectedContacts
            OR ( 
              ${nameAndPhoneNumberSearchSql(
                ["c.\"rawJson\"->'callerInformation'->>'firstName'"],
                ["c.\"rawJson\"->'callerInformation'->>'lastName'"],
                [
                  "c.\"rawJson\"->'callerInformation'->'location'->>'phone1'",
                  "c.\"rawJson\"->'callerInformation'->'location'->>'phone2'",
                ],
              )}  
            )
          )
      )
      -- search on case sections in the expected format
      OR EXISTS (
        SELECT 1 FROM "CaseSections" cs WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"
          AND
          ${nameAndPhoneNumberSearchSql(
            ['cs."sectionTypeSpecificData"->>\'firstName\''],
            ['cs."sectionTypeSpecificData"->>\'lastName\''],
            [
              'cs."sectionTypeSpecificData"->>\'phone1\'',
              'cs."sectionTypeSpecificData"->>\'phone2\'',
            ],
          )}
      )
    )
    AND (
      $<contactNumber> IS NULL OR
      EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid" AND c.number = $<contactNumber>
      )
    )`;

const selectCasesUnorderedSql = ({
  whereClause,
  havingClause = '',
}: Omit<SelectCasesParams, 'orderByClause'>) => {
  return `
  SELECT DISTINCT ON (cases."accountSid", cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    "cases".*,
    "contactsOwnedCount"."contactsOwnedByUserCount"
  FROM "Cases" "cases"
  LEFT JOIN LATERAL (
      ${selectContactsOwnedCount('twilioWorkerSid')}
  ) "contactsOwnedCount" ON true
  ${whereClause ?? ''} GROUP BY
    "cases"."accountSid",
    "cases"."id",
    "contactsOwnedCount"."contactsOwnedByUserCount"
  ${havingClause}`;
};

type SelectCasesParams = {
  whereClause: string;
  orderByClause: string;
  havingClause?: string;
};

const selectCasesPaginatedSql = ({
  whereClause,
  orderByClause,
  havingClause = '',
}: SelectCasesParams) => `
SELECT * FROM (${selectCasesUnorderedSql({
  whereClause,
  havingClause,
})}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;

export type SearchQueryBuilder = (
  user: TwilioUser,
  viewCasePermissions: TKConditionsSets<'case'>,
  filters: CaseListFilters,
  orderByClauses: OrderByClauseItem[],
) => string;

const selectSearchCaseBaseQuery = (whereClause: string): SearchQueryBuilder => {
  return (
    user: TwilioUser,
    viewCasePermissions: TKConditionsSets<'case'>,
    filters,
    orderByClauses,
  ) => {
    const whereSql = [
      whereClause,
      ...listCasesPermissionWhereClause(
        viewCasePermissions as CaseListCondition[][],
        user.isSupervisor,
      ),
      filterSql(filters),
    ].filter(sql => sql).join(`
    AND `);
    const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
    return selectCasesPaginatedSql({
      whereClause: whereSql ? `WHERE ${whereSql}` : null,
      orderByClause: orderBySql,
    });
  };
};

export const selectCaseSearch = selectSearchCaseBaseQuery(
  `$<accountSid> IS NOT NULL AND cases."accountSid" = $<accountSid>
    AND ${SEARCH_WHERE_CLAUSE}
  `,
);

export const selectCaseFilterOnly = selectSearchCaseBaseQuery(
  'cases."accountSid" = $<accountSid>',
);

export const selectCaseSearchByProfileId = selectSearchCaseBaseQuery(
  `cases."accountSid" = $<accountSid> AND cases."id" IN (
    SELECT "caseId" FROM "Contacts" "c" WHERE "c"."profileId" = $<profileId> AND "c"."accountSid" = $<accountSid>
  )`,
);

export const selectCasesByIds = selectSearchCaseBaseQuery(
  `cases."accountSid" = $<accountSid> AND cases."id" = ANY($<caseIds>::INTEGER[])`,
);
