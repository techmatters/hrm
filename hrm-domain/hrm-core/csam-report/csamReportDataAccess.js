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
exports.updateAcknowledgedByCsamReportId = exports.getByContactId = exports.getById = exports.create = void 0;
const csam_report_insert_sql_1 = require("./sql/csam-report-insert-sql");
const csam_report_get_sql_1 = require("./sql/csam-report-get-sql");
const csam_report_update_sql_1 = require("./sql/csam-report-update-sql");
const dbConnection_1 = require("../dbConnection");
const create = async (newCsamReport, accountSid) => {
    const now = new Date();
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (connection) => {
        const statement = (0, csam_report_insert_sql_1.insertCSAMReportSql)({
            ...newCsamReport,
            updatedAt: now,
            createdAt: now,
            accountSid,
        });
        return connection.one(statement);
    });
};
exports.create = create;
const getById = async (reportId, accountSid) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.oneOrNone(csam_report_get_sql_1.selectSingleCsamReportByIdSql, {
    accountSid,
    reportId,
}));
exports.getById = getById;
const getByContactId = async (contactId, accountSid) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.manyOrNone(csam_report_get_sql_1.selectCsamReportsByContactIdSql, {
    contactId,
    accountSid,
}));
exports.getByContactId = getByContactId;
const updateAcknowledgedByCsamReportId = (acknowledged) => async (reportId, accountSid) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.oneOrNone(csam_report_update_sql_1.updateAcknowledgedByCsamReportIdSql, {
    reportId,
    accountSid,
    acknowledged,
}));
exports.updateAcknowledgedByCsamReportId = updateAcknowledgedByCsamReportId;
