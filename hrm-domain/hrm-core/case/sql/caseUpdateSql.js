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
exports.TOUCH_CASE_SQL = exports.PATCH_CASE_INFO_BY_ID = exports.updateByIdSql = void 0;
const dbConnection_1 = require("../../dbConnection");
const VALID_CASE_UPDATE_FIELDS = ['info', 'status', 'updatedAt', 'updatedBy'];
const updateCaseColumnSet = new dbConnection_1.pgp.helpers.ColumnSet(VALID_CASE_UPDATE_FIELDS.map(f => ({
    name: f,
    skip: val => !val.exists,
})), { table: 'Cases' });
const statusUpdatedSetSql = (parameters) => parameters.status
    ? dbConnection_1.pgp.as.format(`
        , 
        "statusUpdatedAt" = CASE WHEN "status" = $<status> THEN "statusUpdatedAt" ELSE CURRENT_TIMESTAMP END,
        "statusUpdatedBy" = CASE WHEN "status" = $<status> THEN "statusUpdatedBy" ELSE $<updatedBy> END,
        "previousStatus" = CASE WHEN "status" = $<status> THEN "previousStatus" ELSE "status" END`, parameters)
    : '';
const updateByIdSql = (updatedValues, accountSid, caseId) => `
        ${dbConnection_1.pgp.helpers.update(updatedValues, updateCaseColumnSet)} 
        ${statusUpdatedSetSql(updatedValues)}
        ${dbConnection_1.pgp.as.format(`WHERE "Cases"."accountSid" = $<accountSid> AND "Cases"."id" = $<caseId> RETURNING *`, {
    accountSid,
    caseId,
})} 
`;
exports.updateByIdSql = updateByIdSql;
exports.PATCH_CASE_INFO_BY_ID = `
UPDATE "Cases" SET 
  "info" = "info" || $<infoPatch>::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP,
  "updatedBy" = $<updatedBy>
WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>
RETURNING *`;
exports.TOUCH_CASE_SQL = `
UPDATE "Cases" 
SET 
  "updatedAt" = CURRENT_TIMESTAMP,
  "updatedBy" = $<updatedBy>
WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>
`;
