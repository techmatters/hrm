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
exports.selectCoalesceCsamReportsByContactId = exports.selectCsamReportsByContactIdSql = exports.selectSingleCsamReportByIdSql = void 0;
const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<reportId>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."contactId" = $<contactId>`;
exports.selectSingleCsamReportByIdSql = `
  SELECT r.*
  FROM "CSAMReports" r
  ${ID_WHERE_CLAUSE}
`;
exports.selectCsamReportsByContactIdSql = `
  SELECT r.*
  FROM "CSAMReports" r
  ${CONTACT_ID_WHERE_CLAUSE}
`;
// Queries used in other modules for JOINs
const onFkFilteredClause = (contactAlias) => `
  r."contactId" = "${contactAlias}".id AND r."accountSid" = "${contactAlias}"."accountSid" AND r."acknowledged" = TRUE
`;
const selectCoalesceCsamReportsByContactId = (contactAlias) => `
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports"
  FROM "CSAMReports" r
  WHERE ${onFkFilteredClause(contactAlias)}
`;
exports.selectCoalesceCsamReportsByContactId = selectCoalesceCsamReportsByContactId;
