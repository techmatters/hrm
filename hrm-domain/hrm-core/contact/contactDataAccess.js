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
exports.streamContactsAfterNotified = exports.searchByIds = exports.searchByProfileId = exports.getByTaskSid = exports.getById = exports.connectToCase = exports.patch = exports.create = void 0;
const dbConnection_1 = require("../dbConnection");
const contactSearchSql_1 = require("./sql/contactSearchSql");
const contact_update_sql_1 = require("./sql/contact-update-sql");
const date_fns_1 = require("date-fns");
const contact_get_sql_1 = require("./sql/contact-get-sql");
const contactInsertSql_1 = require("./sql/contactInsertSql");
const sql_1 = require("../sql");
const caseUpdateSql_1 = require("../case/sql/caseUpdateSql");
const types_1 = require("@tech-matters/types");
const pg_query_stream_1 = __importDefault(require("pg-query-stream"));
const BLANK_CONTACT_UPDATES = {
    caseInformation: undefined,
    callerInformation: undefined,
    categories: undefined,
    childInformation: undefined,
    contactlessTask: undefined,
    callType: undefined,
    definitionVersion: undefined,
    queueName: undefined,
    helpline: undefined,
    channel: undefined,
    number: undefined,
    timeOfContact: undefined,
    taskId: undefined,
    channelSid: undefined,
    serviceSid: undefined,
    caseId: undefined,
    twilioWorkerId: undefined,
    conversationDuration: undefined,
    llmSupportedEntries: undefined,
    hangUpBy: undefined,
};
const create = (task) => async (accountSid, newContact) => {
    try {
        return (0, types_1.newOkFromData)(await (0, sql_1.txIfNotInOne)(await (0, dbConnection_1.getDbForAccount)(accountSid), task, async (conn) => {
            const now = new Date();
            const { isNewRecord, ...created } = await conn.one(contactInsertSql_1.INSERT_CONTACT_SQL, {
                ...newContact,
                accountSid,
                createdAt: now,
                updatedAt: now,
            });
            return { contact: created, isNewRecord };
        }));
    }
    catch (error) {
        return (0, sql_1.inferPostgresErrorResult)(error);
    }
};
exports.create = create;
const patch = (task) => async (accountSid, contactId, finalize, contactUpdates, contactUpdateFieldExclusions) => {
    return (0, sql_1.txIfNotInOne)(await (0, dbConnection_1.getDbForAccount)(accountSid), task, async (connection) => {
        const updatedContact = await connection.oneOrNone((0, contact_update_sql_1.generateUpdateContactByIdSql)(contactUpdateFieldExclusions), {
            ...BLANK_CONTACT_UPDATES,
            accountSid,
            contactId,
            ...contactUpdates,
            finalize,
        });
        return updatedContact;
    });
};
exports.patch = patch;
const connectToCase = (task) => async (accountSid, contactId, caseId, updatedBy) => {
    return (0, sql_1.txIfNotInOne)(await (0, dbConnection_1.getDbForAccount)(accountSid), task, async (connection) => {
        const [[updatedContact]] = await connection.multi([contact_update_sql_1.UPDATE_CASEID_BY_ID, caseUpdateSql_1.TOUCH_CASE_SQL].join(';\n'), {
            accountSid,
            contactId,
            caseId,
            updatedBy,
        });
        return updatedContact;
    });
};
exports.connectToCase = connectToCase;
const getById = async (accountSid, contactId) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.oneOrNone((0, contact_get_sql_1.selectSingleContactByIdSql)('Contacts'), {
    accountSid,
    contactId,
}));
exports.getById = getById;
const getByTaskSid = async (accountSid, taskId) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.oneOrNone((0, contact_get_sql_1.selectSingleContactByTaskId)('Contacts'), {
    accountSid,
    taskId,
}));
exports.getByTaskSid = getByTaskSid;
const generalizedSearchQueryFunction = (sqlQueryGenerator, sqlQueryParamsBuilder) => {
    return async (accountSid, searchParameters, limit, offset, user, viewPermissions) => {
        return (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => {
            const sql = sqlQueryGenerator(viewPermissions, user.isSupervisor);
            const parameters = sqlQueryParamsBuilder(accountSid, user, searchParameters, limit, offset);
            const searchResults = await connection.manyOrNone(sql, parameters);
            return {
                rows: searchResults,
                count: searchResults.length ? searchResults[0].totalCount : 0,
            };
        });
    };
};
exports.searchByProfileId = generalizedSearchQueryFunction(contactSearchSql_1.selectContactsByProfileId, (accountSid, { workerSid }, searchParameters, limit, offset) => {
    return {
        accountSid,
        twilioWorkerSid: workerSid,
        limit,
        offset,
        counselor: searchParameters.counselor,
        helpline: searchParameters.helpline,
        profileId: searchParameters.profileId,
    };
});
exports.searchByIds = generalizedSearchQueryFunction(contactSearchSql_1.getContactsByIds, (accountSid, { workerSid }, searchParameters, limit, offset) => ({
    accountSid,
    twilioWorkerSid: workerSid,
    limit,
    offset,
    counselor: searchParameters.counselor,
    contactIds: searchParameters.contactIds,
}));
const streamContactsAfterNotified = ({ accountSid, searchParameters, batchSize = 1000, }) => {
    const qs = new pg_query_stream_1.default(dbConnection_1.pgp.as.format(contactSearchSql_1.SELECT_CONTACTS_TO_RENOTIFY, {
        accountSid,
        dateFrom: (0, date_fns_1.parseISO)(searchParameters.dateFrom).toISOString(),
        dateTo: (0, date_fns_1.parseISO)(searchParameters.dateTo).toISOString(),
    }), [], {
        batchSize,
    });
    // Expose the readable stream to the caller as a promise for further pipelining
    return new Promise(resolve => {
        Promise.resolve((0, dbConnection_1.getDbForAdmin)()).then(db => db.stream(qs, resultStream => {
            resolve(resultStream);
        }));
    });
};
exports.streamContactsAfterNotified = streamContactsAfterNotified;
