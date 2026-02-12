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
exports.listProfilesSql = exports.OrderByColumn = void 0;
const dbConnection_1 = require("../../dbConnection");
const sql_1 = require("../../sql");
const profile_get_sql_1 = require("./profile-get-sql");
exports.OrderByColumn = {
    ID: 'id',
    NAME: 'name',
};
const ORDER_BY_FIELDS = {
    id: dbConnection_1.pgp.as.name('id'),
    name: dbConnection_1.pgp.as.name('name'),
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
const selectProfilesUnorderedSql = (whereClause) => `
  SELECT (count(*) OVER())::INTEGER AS "totalCount", *
  FROM "Profiles" profiles
  ${whereClause}
`;
const listProfilesPaginatedSql = (whereClause, orderByClause) => `
  ${(0, profile_get_sql_1.getProfilesSqlBase)(`
    ${selectProfilesUnorderedSql(whereClause)}
    ${orderByClause}
    OFFSET $<offset>
    LIMIT $<limit>`, false)}
  ${orderByClause};
`;
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
const filterSql = ({ profileFlagIds, createdAt, updatedAt }) => {
    const filterSqlClauses = [];
    if (profileFlagIds && profileFlagIds.length) {
        filterSqlClauses.push(`profiles.id IN (SELECT "profileId" FROM "ProfilesToProfileFlags" WHERE "profileFlagId" IN ($<profileFlagIds:csv>))`);
    }
    if (createdAt) {
        filterSqlClauses.push(dateFilterCondition("profiles.\"createdAt\"::TIMESTAMP WITH TIME ZONE" /* FilterableDateField.CREATED_AT */, 'createdAt', createdAt));
    }
    if (updatedAt) {
        filterSqlClauses.push(dateFilterCondition("profiles.\"updatedAt\"::TIMESTAMP WITH TIME ZONE" /* FilterableDateField.UPDATED_AT */, 'updatedAt', updatedAt));
    }
    return filterSqlClauses.join(`
  AND `);
};
const listProfilesBaseQuery = (whereClause) => {
    return (filters, orderByClauses) => {
        const whereSql = [whereClause, filterSql(filters)].filter(sql => sql).join(`
    AND `);
        const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
        return listProfilesPaginatedSql(whereSql, orderBySql);
    };
};
exports.listProfilesSql = listProfilesBaseQuery(`
  WHERE profiles."accountSid" = $<accountSid>
`);
