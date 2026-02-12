"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECT_CASES_TO_RENOTIFY = exports.selectCasesByIds = exports.selectCaseSearchByProfileId = exports.selectCaseFilterOnly = exports.OrderByColumn = void 0;
const dbConnection_1 = require("../../dbConnection");
const sql_1 = require("../../sql");
const caseGetSql_1 = require("./caseGetSql");
const casePermissionSql_1 = require("./casePermissionSql");
exports.OrderByColumn = {
    ID: 'id',
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
    LABEL: 'label',
};
const ORDER_BY_FIELDS = {
    id: dbConnection_1.pgp.as.name('id'),
    createdAt: dbConnection_1.pgp.as.name('createdAt'),
    updatedAt: dbConnection_1.pgp.as.name('updatedAt'),
    label: dbConnection_1.pgp.as.name('label'),
};
const DEFAULT_SORT = [
    { sortBy: 'id', sortDirection: sql_1.OrderByDirection.descending },
];
const generateOrderByClause = (clauses) => {
    const validClauses = clauses.filter(c => ORDER_BY_FIELDS[c.sortBy]);
    if (clauses.length > 0) {
        return ` ORDER BY ${validClauses
            .map(t => `${ORDER_BY_FIELDS[t.sortBy]} ${t.sortDirection}`)
            .join(', ')}`;
    }
    else
        return '';
};
const dateFilterCondition = (field, filterName, filter) => {
    let existsCondition;
    if (filter.exists === "MUST_EXIST" /* DateExistsCondition.MUST_EXIST */) {
        existsCondition = `(${field} IS NOT NULL)`;
    }
    else if (filter.exists === "MUST_NOT_EXIST" /* DateExistsCondition.MUST_NOT_EXIST */) {
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
const filterSql = ({ counsellors, statuses, createdAt = {}, updatedAt = {}, helplines, excludedStatuses, includeOrphans, caseInfoFilters, }) => {
    const filterSqlClauses = [];
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
    filterSqlClauses.push(...[
        dateFilterCondition("cases.\"createdAt\"::TIMESTAMP WITH TIME ZONE" /* FilterableDateField.CREATED_AT */, 'createdAt', createdAt),
        dateFilterCondition("cases.\"updatedAt\"::TIMESTAMP WITH TIME ZONE" /* FilterableDateField.UPDATED_AT */, 'updatedAt', updatedAt),
    ].filter(sql => sql));
    if (caseInfoFilters) {
        Object.entries(caseInfoFilters).forEach(([key, values]) => {
            // Handle multi-select filters
            if (Array.isArray(values) && values.length) {
                const clause = `cases."info"->>'${key}' IN ($<caseInfoFilters.${key}:csv>)`;
                filterSqlClauses.push(clause);
            }
            // Handle date range filters like FilterableDateField
            else if (typeof values === 'object' &&
                !Array.isArray(values) &&
                values) {
                const fieldExpr = `CAST(NULLIF(cases."info"->>'${key}', '') AS TIMESTAMP WITH TIME ZONE)`;
                const paramName = `caseInfoFilters.${key}`;
                const dateClause = dateFilterCondition(fieldExpr, paramName, values);
                filterSqlClauses.push(dateClause);
            }
        });
    }
    if (!includeOrphans) {
        filterSqlClauses.push(`EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
      )`);
    }
    return filterSqlClauses.join(`
  AND `);
};
const selectCasesUnorderedSql = ({ whereClause, havingClause = '', }) => {
    return `
  SELECT DISTINCT ON (cases."accountSid", cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    "cases".*,
    "contactsOwnedCount"."contactsOwnedByUserCount"
  FROM "Cases" "cases"
  LEFT JOIN LATERAL (
      ${(0, caseGetSql_1.selectContactsOwnedCount)('twilioWorkerSid')}
  ) "contactsOwnedCount" ON true
  ${whereClause ?? ''} GROUP BY
    "cases"."accountSid",
    "cases"."id",
    "contactsOwnedCount"."contactsOwnedByUserCount"
  ${havingClause}`;
};
const selectCasesPaginatedSql = ({ whereClause, orderByClause, havingClause = '', }) => `
SELECT * FROM (${selectCasesUnorderedSql({
    whereClause,
    havingClause,
})}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;
const selectSearchCaseBaseQuery = (whereClause) => {
    return (user, viewCasePermissions, filters, orderByClauses) => {
        const whereSql = [
            whereClause,
            ...(0, casePermissionSql_1.listCasesPermissionWhereClause)(viewCasePermissions, user.isSupervisor),
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
exports.selectCaseFilterOnly = selectSearchCaseBaseQuery('cases."accountSid" = $<accountSid>');
exports.selectCaseSearchByProfileId = selectSearchCaseBaseQuery(`cases."accountSid" = $<accountSid> AND cases."id" IN (
    SELECT "caseId" FROM "Contacts" "c" WHERE "c"."profileId" = $<profileId> AND "c"."accountSid" = $<accountSid>
  )`);
exports.selectCasesByIds = selectSearchCaseBaseQuery(`cases."accountSid" = $<accountSid> AND cases."id" = ANY($<caseIds>::INTEGER[])`);
exports.SELECT_CASES_TO_RENOTIFY = `
  SELECT DISTINCT ON (cases."accountSid", cases.id)
      "cases"."id"::text as "id",
      "cases"."createdAt",
      "cases"."updatedAt",
      "cases".status,
      "cases".helpline,
      "cases"."info",
      "cases"."twilioWorkerId",
      "cases"."accountSid",
      "cases"."createdBy",
      "cases"."updatedBy",
      "cases"."statusUpdatedAt",
      "cases"."statusUpdatedBy",
      "cases"."previousStatus",
      "cases".label,
      "cases"."definitionVersion"
  FROM "Cases" "cases"
  WHERE "cases"."accountSid" = $<accountSid> AND "cases"."updatedAt" BETWEEN $<dateFrom> AND $<dateTo>
`;
