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
import { SELECT_CASE_SECTIONS } from './case-sections-sql';
import { CaseListFilters, DateExistsCondition, DateFilter } from '../case-data-access';
import { leftJoinCsamReportsOnFK } from '../../csam-report/sql/csam-report-get-sql';
import { leftJoinReferralsOnFK } from '../../referral/sql/referral-get-sql';

export const OrderByDirection = {
  ascendingNullsLast: 'ASC NULLS LAST',
  descendingNullsLast: 'DESC NULLS LAST',
  ascending: 'ASC',
  descending: 'DESC',
} as const;

export type OrderByDirectionType = typeof OrderByDirection[keyof typeof OrderByDirection];

export const OrderByColumn = {
  ID: 'id',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  CHILD_NAME: 'childName',
  FOLLOW_UP_DATE: 'info.followUpDate',
} as const;

export type OrderByColumnType = typeof OrderByColumn[keyof typeof OrderByColumn];

const ORDER_BY_FIELDS: Record<OrderByColumnType, string> = {
  id: pgp.as.name('id'),
  createdAt: pgp.as.name('createdAt'),
  updatedAt: pgp.as.name('updatedAt'),
  'info.followUpDate': `"info"->>'followUpDate'`,
  childName: pgp.as.name('childName'),
} as const;

type OrderByClauseItem = { sortBy: string; sortDirection: OrderByDirectionType };

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

const SELECT_CONTACTS = `SELECT COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts."caseId" IS NOT NULL), '[]') AS "connectedContacts"
FROM (
  SELECT
    c.*,
    COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports",
    COALESCE(jsonb_agg(DISTINCT referral.*) FILTER (WHERE referral IS NOT NULL), '[]') AS "referrals"
  FROM "Contacts" c 
  ${leftJoinCsamReportsOnFK('c')}
  ${leftJoinReferralsOnFK('c')}
  WHERE c."caseId" = "cases".id AND c."accountSid" = "cases"."accountSid"
  GROUP BY c."accountSid", c.id
) AS contacts WHERE contacts."caseId" = cases.id AND contacts."accountSid" = cases."accountSid"`;

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

// Produces a table of category / subcategory pairs from the input category filters, and another from the categories specified in the contact json, and joins on them
const CATEGORIES_FILTER_SQL = `EXISTS (
SELECT 1 FROM 
(
    SELECT categories.key AS category, subcategories.key AS subcategory 
    FROM "Contacts" c, jsonb_each(c."rawJson"->'caseInformation'->'categories') categories, jsonb_each_text(categories.value) AS subcategories 
    WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid" AND subcategories.value = 'true'
) AS availableCategories
INNER JOIN jsonb_to_recordset($<categories:json>) AS requiredCategories(category text, subcategory text) 
ON requiredCategories.category = availableCategories.category AND requiredCategories.subcategory = availableCategories.subcategory
)`;

const filterSql = ({
  counsellors,
  statuses,
  createdAt = {},
  updatedAt = {},
  followUpDate = {},
  categories,
  helplines,
  excludedStatuses,
  includeOrphans,
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
  filterSqlClauses.push(
    ...[
      dateFilterCondition(FilterableDateField.CREATED_AT, 'createdAt', createdAt),
      dateFilterCondition(FilterableDateField.UPDATED_AT, 'updatedAt', updatedAt),
      dateFilterCondition(FilterableDateField.FOLLOW_UP_DATE, 'followUpDate', followUpDate),
    ].filter(sql => sql),
  );
  if (categories && categories.length) {
    filterSqlClauses.push(CATEGORIES_FILTER_SQL);
  }
  if (!includeOrphans) {
    filterSqlClauses.push(`jsonb_array_length(contacts."connectedContacts") > 0`);
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
              [
                "c.\"rawJson\"->'childInformation'->>'firstName'",
                // Legacy format support, remove when old contacts are migrated
                "c.\"rawJson\"->'childInformation'->'name'->>'firstName'",
              ],
              [
                "c.\"rawJson\"->'childInformation'->>'lastName'",
                // Legacy format support, remove when old contacts are migrated
                "c.\"rawJson\"->'childInformation'->'name'->>'lastName'",
              ],
              [
                "c.\"rawJson\"->'childInformation'->'location'->>'phone1'",
                "c.\"rawJson\"->'childInformation'->'location'->>'phone2'",
                'c.number',
              ],
            )})
            -- search on callerInformation of connectedContacts
            OR ( 
              ${nameAndPhoneNumberSearchSql(
                [
                  "c.\"rawJson\"->'callerInformation'->>'firstName'",
                  // Legacy format support, remove when old contacts are migrated
                  "c.\"rawJson\"->'callerInformation'->'name'->>'firstName'",
                ],
                [
                  "c.\"rawJson\"->'callerInformation'->>'lastName'",
                  // Legacy format support, remove when old contacts are migrated
                  "c.\"rawJson\"->'callerInformation'->'name'->>'lastName'",
                ],
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

const selectCasesUnorderedSql = (whereClause: string, havingClause: string = '') =>
  `SELECT DISTINCT ON (cases."accountSid", cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*,
    contacts."connectedContacts",
    NULLIF(
      CONCAT(
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "firstName"}', 
        ' ', 
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "lastName"}'
      )
    , ' ') AS "childName",  
    caseSections."caseSections"
    FROM "Cases" cases 
    LEFT JOIN LATERAL (${SELECT_CONTACTS}) contacts ON true 
    LEFT JOIN LATERAL (${SELECT_CASE_SECTIONS}) caseSections ON true
    ${whereClause} GROUP BY "cases"."accountSid", "cases"."id", caseSections."caseSections", contacts."connectedContacts" ${havingClause}`;

const selectCasesPaginatedSql = (
  whereClause: string,
  orderByClause: string,
  havingClause: string = '',
) => `
SELECT * FROM (${selectCasesUnorderedSql(whereClause, havingClause)}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;

export const selectCaseSearch = (
  filters: CaseListFilters,
  orderByClauses: OrderByClauseItem[] = [],
) => {
  const whereSql = [
    `WHERE
    (info IS NULL OR jsonb_typeof(info) = 'object')
    AND
      $<accountSid> IS NOT NULL AND cases."accountSid" = $<accountSid>`,
    SEARCH_WHERE_CLAUSE,
    filterSql(filters),
  ].filter(sql => sql).join(`
  AND `);
  const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
  return selectCasesPaginatedSql(whereSql, orderBySql);
};
