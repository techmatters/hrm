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
import { SELECT_CASE_SECTIONS } from './case-sections-sql';
import { CaseListFilters } from '../caseDataAccess';
import { selectCoalesceCsamReportsByContactId } from '../../csam-report/sql/csam-report-get-sql';
import { selectCoalesceReferralsByContactId } from '../../referral/sql/referral-get-sql';
import { selectCoalesceConversationMediasByContactId } from '../../conversation-media/sql/conversation-media-get-sql';
import { OrderByClauseItem, OrderByDirection } from '../../sql';
import { selectContactsOwnedCount } from './caseGetSql';
import { CaseListCondition, listCasesPermissionWhereClause } from './casePermissionSql';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { TKConditionsSets } from '../../permissions/rulesMap';
import {
  ContactListCondition,
  listContactsPermissionWhereClause,
} from '../../contact/sql/contactPermissionSql';

export const OrderByColumn = {
  ID: 'id',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  CHILD_NAME: 'childName',
} as const;

export type OrderByColumnType = (typeof OrderByColumn)[keyof typeof OrderByColumn];

const ORDER_BY_FIELDS: Record<OrderByColumnType, string> = {
  id: pgp.as.name('id'),
  createdAt: pgp.as.name('createdAt'),
  updatedAt: pgp.as.name('updatedAt'),
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

const selectContacts = (
  contactViewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
  onlyEssentialData?: boolean,
) => {
  const innerSelect = onlyEssentialData
    ? '(SELECT c.*)'
    : '(SELECT c.*, reports."csamReports", joinedReferrals."referrals", media."conversationMedia")';

  const leftJoins = onlyEssentialData
    ? ''
    : `
      LEFT JOIN LATERAL (
        ${selectCoalesceCsamReportsByContactId('c')}
      ) reports ON true
      LEFT JOIN LATERAL (
        ${selectCoalesceReferralsByContactId('c')}
      ) joinedReferrals ON true
      LEFT JOIN LATERAL (
        ${selectCoalesceConversationMediasByContactId('c')}
      ) media ON true`;

  return `
    SELECT COALESCE(jsonb_agg(DISTINCT contacts."jsonBlob") FILTER (WHERE contacts."caseId" IS NOT NULL), '[]') AS "connectedContacts"
    FROM ( 
      SELECT
        c."accountSid",
        c."caseId",
        c."twilioWorkerId",
        c."timeOfContact",
        (SELECT to_jsonb(_row) FROM ${innerSelect} AS _row) AS "jsonBlob"
      FROM "Contacts" c
      ${leftJoins}
      ) AS "contacts" 
      WHERE "contacts"."caseId" = "cases".id AND "contacts"."accountSid" = "cases"."accountSid"
      AND ${listContactsPermissionWhereClause(
        contactViewPermissions as ContactListCondition[][],
        userIsSupervisor,
      )}
      GROUP BY "contacts"."caseId", "contacts"."accountSid"
      `;
};

const enum FilterableDateField {
  CREATED_AT = 'cases."createdAt"::TIMESTAMP WITH TIME ZONE',
  UPDATED_AT = 'cases."updatedAt"::TIMESTAMP WITH TIME ZONE',
}

const dateFilterCondition = (
  field: FilterableDateField | string,
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
    SELECT categories.key AS category, subcategories AS subcategory 
    FROM "Contacts" c, jsonb_each(c."rawJson"->'categories') categories, jsonb_array_elements_text(categories.value) AS subcategories 
    WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
) AS availableCategories
INNER JOIN jsonb_to_recordset($<categories:json>) AS requiredCategories(category text, subcategory text) 
ON requiredCategories.category = availableCategories.category AND requiredCategories.subcategory = availableCategories.subcategory
)`;

const filterSql = ({
  counsellors,
  statuses,
  createdAt = {},
  updatedAt = {},
  categories,
  helplines,
  excludedStatuses,
  includeOrphans,
  caseInfoFilters,
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
    ].filter(sql => sql),
  );
  if (caseInfoFilters) {
    Object.entries(caseInfoFilters).forEach(([key, values]) => {
      // Handle multi-select filters
      if (Array.isArray(values) && values.length) {
        const clause = `cases."info"->>'${key}' IN ($<caseInfoFilters.${key}:csv>)`;
        filterSqlClauses.push(clause);
      }
      // Handle date range filters like FilterableDateField
      else if (
        typeof values === 'object' &&
        !Array.isArray(values) &&
        (values as DateFilter)
      ) {
        const fieldExpr = `CAST(NULLIF(cases."info"->>'${key}', '') AS TIMESTAMP WITH TIME ZONE)`;
        const paramName = `caseInfoFilters.${key}`;
        const dateClause = dateFilterCondition(fieldExpr, paramName, values);
        filterSqlClauses.push(dateClause);
      }
    });
  }

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

const selectCasesUnorderedSql = (
  { whereClause, havingClause = '' }: Omit<SelectCasesParams, 'orderByClause'>,
  contactViewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
  onlyEssentialData?: boolean,
) => {
  const ifCaseSections = (query: string) => (onlyEssentialData ? '' : query);

  return `
  SELECT DISTINCT ON (cases."accountSid", cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    "cases".*,
    "contacts"."connectedContacts",
    "contactsOwnedCount"."contactsOwnedByUserCount",
    NULLIF(
      CONCAT(
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "firstName"}', 
        ' ', 
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "lastName"}'
      )
    , ' ') AS "childName"
    ${ifCaseSections(`, "caseSections"."caseSections"`)}
  FROM "Cases" "cases"
  LEFT JOIN LATERAL (${selectContacts(
    contactViewPermissions,
    userIsSupervisor,
    onlyEssentialData,
  )}) contacts ON true
  ${ifCaseSections(`LEFT JOIN LATERAL (${SELECT_CASE_SECTIONS}) "caseSections" ON true`)}
  LEFT JOIN LATERAL (
      ${selectContactsOwnedCount('twilioWorkerSid')}
  ) "contactsOwnedCount" ON true
  ${whereClause} GROUP BY
    "cases"."accountSid",
    "cases"."id",
    ${ifCaseSections(`"caseSections"."caseSections",`)}
    "contacts"."connectedContacts",
    "contactsOwnedCount"."contactsOwnedByUserCount"
  ${havingClause}`;
};

type SelectCasesParams = {
  whereClause: string;
  orderByClause: string;
  havingClause?: string;
};

const selectCasesPaginatedSql = (
  { whereClause, orderByClause, havingClause = '' }: SelectCasesParams,
  contactViewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
  onlyEssentialData?: boolean,
) => `
SELECT * FROM (${selectCasesUnorderedSql(
  { whereClause, havingClause },
  contactViewPermissions,
  userIsSupervisor,
  onlyEssentialData,
)}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;

export type SearchQueryBuilder = (
  user: TwilioUser,
  viewCasePermissions: TKConditionsSets<'case'>,
  viewContactPermissions: TKConditionsSets<'contact'>,
  filters: CaseListFilters,
  orderByClauses: OrderByClauseItem[],
  onlyEssentialData?: boolean,
) => string;

const selectSearchCaseBaseQuery = (whereClause: string): SearchQueryBuilder => {
  return (
    user: TwilioUser,
    viewCasePermissions: TKConditionsSets<'case'>,
    contactViewPermissions: TKConditionsSets<'contact'>,
    filters,
    orderByClauses,
    onlyEssentialData,
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
    return selectCasesPaginatedSql(
      { whereClause: whereSql, orderByClause: orderBySql },
      contactViewPermissions,
      user.isSupervisor,
      onlyEssentialData,
    );
  };
};

export const selectCaseSearch = selectSearchCaseBaseQuery(
  `WHERE
      $<accountSid> IS NOT NULL AND cases."accountSid" = $<accountSid>
    AND ${SEARCH_WHERE_CLAUSE}
  `,
);

export const selectCaseSearchByProfileId = selectSearchCaseBaseQuery(
  `WHERE cases."accountSid" = $<accountSid> AND cases."id" IN (
    SELECT "caseId" FROM "Contacts" "c" WHERE "c"."profileId" = $<profileId> AND "c"."accountSid" = $<accountSid>
  )`,
);

export const selectCasesByIds = selectSearchCaseBaseQuery(
  `WHERE cases."accountSid" = $<accountSid> AND cases."id" = ANY($<caseIds>::INTEGER[])`,
);
