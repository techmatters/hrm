"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectSingleCaseByIdSql = exports.selectContactsOwnedCount = void 0;
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
const ID_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`;
const selectContactsOwnedCount = (ownerVariableName) => `SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<${ownerVariableName}>`;
exports.selectContactsOwnedCount = selectContactsOwnedCount;
const selectSingleCaseByIdSql = (tableName) => `SELECT
      "cases".*,
      "contactsOwnedCount"."contactsOwnedByUserCount"
      FROM "${tableName}" AS "cases"
      LEFT JOIN LATERAL (
        ${(0, exports.selectContactsOwnedCount)('twilioWorkerSid')}
      ) "contactsOwnedCount" ON true
      ${ID_WHERE_CLAUSE}`;
exports.selectSingleCaseByIdSql = selectSingleCaseByIdSql;
