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
exports.getTimeline = exports.updateById = exports.deleteById = exports.getById = exports.create = void 0;
const dbConnection_1 = require("../../dbConnection");
const readSql_1 = require("./sql/readSql");
const deleteSql_1 = require("./sql/deleteSql");
const updateSql_1 = require("./sql/updateSql");
const types_1 = require("@tech-matters/types");
const sql_1 = require("../../sql");
const caseUpdateSql_1 = require("../sql/caseUpdateSql");
const create = (task) => async (sectionRecord) => {
    try {
        const insertSectionStatement = `${dbConnection_1.pgp.helpers.insert(sectionRecord, [
            'caseId',
            'sectionType',
            'sectionId',
            'createdBy',
            'createdAt',
            'sectionTypeSpecificData',
            'accountSid',
            'eventTimestamp',
        ], 'CaseSections')} RETURNING *`;
        const db = await (0, dbConnection_1.getDbForAccount)(sectionRecord.accountSid);
        return await (0, sql_1.txIfNotInOne)(db, task, async (connection) => {
            const [[createdSection]] = await connection.multi([insertSectionStatement, caseUpdateSql_1.TOUCH_CASE_SQL].join(';\n'), {
                accountSid: sectionRecord.accountSid,
                caseId: sectionRecord.caseId,
                updatedBy: sectionRecord.createdBy,
            });
            return (0, types_1.newOkFromData)(createdSection);
        });
    }
    catch (error) {
        return (0, sql_1.inferPostgresErrorResult)(error);
    }
};
exports.create = create;
const getById = async (accountSid, caseId, sectionType, sectionId) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (connection) => {
        const queryValues = { accountSid, caseId, sectionType, sectionId };
        return connection.oneOrNone(readSql_1.SELECT_CASE_SECTION_BY_ID, queryValues);
    });
};
exports.getById = getById;
const deleteById = (task) => async (accountSid, caseId, sectionType, sectionId, updatedBy) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, async (connection) => {
        const [[deletedSection]] = await connection.multi([deleteSql_1.DELETE_CASE_SECTION_BY_ID, caseUpdateSql_1.TOUCH_CASE_SQL].join(';\n'), {
            accountSid,
            caseId,
            sectionType,
            sectionId,
            updatedBy,
        });
        return deletedSection;
    });
};
exports.deleteById = deleteById;
const updateById = (task) => async (accountSid, caseId, sectionType, sectionId, updates) => {
    const statementValues = {
        accountSid,
        caseId,
        sectionType,
        sectionId,
        eventTimestamp: null,
        ...updates,
    };
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, async (connection) => {
        const [[updatedSection]] = await connection.multi([updateSql_1.UPDATE_CASE_SECTION_BY_ID, caseUpdateSql_1.TOUCH_CASE_SQL].join(';\n'), statementValues);
        return updatedSection;
    });
};
exports.updateById = updateById;
const getTimeline = async (accountSid, twilioUser, viewContactsPermissions, caseIds, sectionTypes, includeContacts, limit, offset) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    let includeSections = 'none';
    if (sectionTypes.length) {
        includeSections = sectionTypes.some(st => st === '*') ? 'all' : 'some';
    }
    const sqlRes = (0, readSql_1.selectCaseTimelineSql)(twilioUser, viewContactsPermissions, includeSections, includeContacts);
    if ((0, types_1.isOk)(sqlRes)) {
        const activitiesWithCounts = await db.manyOrNone(sqlRes.data, {
            limit,
            offset,
            caseIds: caseIds.map(id => parseInt(id)),
            accountSid,
            twilioWorkerSid: twilioUser.workerSid,
            sectionTypes,
        });
        const count = activitiesWithCounts.length ? activitiesWithCounts[0].totalCount : 0;
        const activities = activitiesWithCounts.map(ewc => {
            const { totalCount, ...activityWithoutCount } = ewc;
            return activityWithoutCount;
        });
        return {
            count,
            activities,
        };
    }
    else {
        console.warn(`Received request for timeline of case ${caseIds} but neither contacts or any case sections were requested, returning empty set`);
        return { count: 0, activities: [] };
    }
};
exports.getTimeline = getTimeline;
