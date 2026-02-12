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
exports.create = exports.filterByContactTaskId = void 0;
const postSurveyGetSql_1 = require("./sql/postSurveyGetSql");
const postSurveyInsertSql_1 = require("./sql/postSurveyInsertSql");
const dbConnection_1 = require("../dbConnection");
const filterByContactTaskId = async (accountSid, contactTaskId) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.manyOrNone(postSurveyGetSql_1.SELECT_POST_SURVEYS_BY_CONTACT_TASK, {
    accountSid,
    contactTaskId,
}));
exports.filterByContactTaskId = filterByContactTaskId;
const create = async (accountSid, postSurvey) => {
    const now = new Date();
    return (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.one((0, postSurveyInsertSql_1.insertPostSurveySql)({ ...postSurvey, updatedAt: now, createdAt: now, accountSid })));
};
exports.create = create;
