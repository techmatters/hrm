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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamCasesForRenotifying = exports.searchByCaseIds = exports.updateCaseInfo = exports.updateStatus = exports.deleteById = exports.searchByProfileId = exports.list = exports.getById = exports.create = exports.VALID_CASE_CREATE_FIELDS = void 0;
const dbConnection_1 = require("../dbConnection");
const search_1 = require("../search");
const caseUpdateSql_1 = require("./sql/caseUpdateSql");
const caseSearchSql_1 = require("./sql/caseSearchSql");
const case_delete_sql_1 = require("./sql/case-delete-sql");
const caseGetSql_1 = require("./sql/caseGetSql");
const lodash_1 = require("lodash");
const pg_query_stream_1 = __importDefault(require("pg-query-stream"));
// Exported for testing
exports.VALID_CASE_CREATE_FIELDS = [
    'accountSid',
    'info',
    'helpline',
    'status',
    'twilioWorkerId',
    'createdBy',
    'createdAt',
    'label',
    'definitionVersion',
];
const create = async (caseRecord) => {
    const db = await (0, dbConnection_1.getDbForAccount)(caseRecord.accountSid);
    return db.task(async (connection) => {
        const statement = `${dbConnection_1.pgp.helpers.insert({
            ...(0, lodash_1.pick)(caseRecord, exports.VALID_CASE_CREATE_FIELDS),
            updatedAt: caseRecord.createdAt,
        }, null, 'Cases')} RETURNING *`;
        let inserted = await connection.one(statement);
        // eslint-disable-next-line @typescript-eslint/dot-notation
        if ((caseRecord['caseSections'] ?? []).length) {
            // No compatibility needed here as flex doesn't create cases with sections
            console.warn(`[DEPRECATION WARNING] Support for creating case sections with a case has been removed as of HRM v1.15.0. Add case sections using the dedicated case section CRUD endpoints going forward.`);
        }
        return inserted;
    });
};
exports.create = create;
const getById = async (caseId, accountSid, { workerSid }) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (connection) => {
        const statement = (0, caseGetSql_1.selectSingleCaseByIdSql)('Cases');
        const queryValues = {
            accountSid,
            caseId,
            twilioWorkerSid: workerSid,
        };
        return connection.oneOrNone(statement, queryValues);
    });
};
exports.getById = getById;
const generalizedSearchQueryFunction = (sqlQueryBuilder, sqlQueryParamsBuilder) => {
    return async (user, casePermissions, listConfiguration, accountSid, searchCriteria, filters) => {
        const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
        const { limit, offset, sortBy, sortDirection } = (0, search_1.getPaginationElements)(listConfiguration);
        const orderClause = [{ sortBy, sortDirection }];
        const { count, rows } = await db.task(async (connection) => {
            const statement = sqlQueryBuilder(user, casePermissions, filters, orderClause);
            const queryValues = sqlQueryParamsBuilder(accountSid, user, searchCriteria, filters, limit, offset);
            const result = await connection.any(statement, queryValues);
            const totalCount = result.length ? result[0].totalCount : 0;
            return { rows: result, count: totalCount };
        });
        return {
            cases: rows,
            count,
        };
    };
};
exports.list = 
// searchCriteria is only set in legacy search queries. Once support for this is removed, remove this check and all supporting SQL
generalizedSearchQueryFunction(caseSearchSql_1.selectCaseFilterOnly, (accountSid, user, _criteria, filters, limit, offset) => ({
    ...filters,
    accountSid,
    limit: limit,
    offset: offset,
    twilioWorkerSid: user.workerSid,
}));
exports.searchByProfileId = generalizedSearchQueryFunction(caseSearchSql_1.selectCaseSearchByProfileId, (accountSid, user, searchParameters, filters, limit, offset) => ({
    accountSid,
    limit,
    offset,
    counsellors: filters.counsellors,
    helpline: filters.helplines,
    profileId: searchParameters.profileId,
    twilioWorkerSid: user.workerSid,
}));
const deleteById = async (id, accountSid) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.oneOrNone(case_delete_sql_1.DELETE_BY_ID, [accountSid, id]);
};
exports.deleteById = deleteById;
const updateStatus = async (id, status, updatedBy, accountSid) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.tx(async (transaction) => {
        return transaction.oneOrNone((0, caseUpdateSql_1.updateByIdSql)({ status, updatedBy, updatedAt: new Date().toISOString() }, accountSid, id));
    });
};
exports.updateStatus = updateStatus;
const updateCaseInfo = async (accountSid, caseId, infoPatch, updatedBy) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.tx(async (transaction) => {
        return transaction.oneOrNone(caseUpdateSql_1.PATCH_CASE_INFO_BY_ID, {
            infoPatch,
            updatedBy,
            updatedAt: new Date().toISOString(),
            accountSid,
            caseId,
        });
    });
};
exports.updateCaseInfo = updateCaseInfo;
exports.searchByCaseIds = generalizedSearchQueryFunction(caseSearchSql_1.selectCasesByIds, (accountSid, user, searchCriteria, filters, limit, offset) => {
    return {
        accountSid,
        limit,
        offset,
        caseIds: searchCriteria.caseIds,
        twilioWorkerSid: user.workerSid,
    };
});
const streamCasesForRenotifying = async ({ accountSid, filters: { from: dateFrom, to: dateTo }, batchSize = 1000, }) => {
    const qs = new pg_query_stream_1.default(dbConnection_1.pgp.as.format(caseSearchSql_1.SELECT_CASES_TO_RENOTIFY, {
        accountSid,
        dateFrom,
        dateTo,
    }), [], {
        batchSize,
    });
    const db = await Promise.resolve((0, dbConnection_1.getDbForAdmin)());
    // Expose the readable stream to the caller as a promise for further pipelining
    return new Promise(resolve => {
        db.stream(qs, resultStream => {
            resolve(resultStream);
        });
    });
};
exports.streamCasesForRenotifying = streamCasesForRenotifying;
