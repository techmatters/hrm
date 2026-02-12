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
exports.selectSingleContactByTaskId = exports.selectSingleContactByIdSql = exports.selectContactsWithRelations = void 0;
const conversation_media_get_sql_1 = require("../../conversation-media/sql/conversation-media-get-sql");
const csam_report_get_sql_1 = require("../../csam-report/sql/csam-report-get-sql");
const referral_get_sql_1 = require("../../referral/sql/referral-get-sql");
const ID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."id" = $<contactId>`;
const TASKID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."taskId" = $<taskId>`;
/**
 * Note: this query is also used to index Contact records in ES. If the JOINs are ever removed from this query, make sure that the JOINs are preserved for the ES dedicated one
 */
const selectContactsWithRelations = (table) => `
        SELECT c.*, reports."csamReports", joinedReferrals."referrals", media."conversationMedia"
        FROM "${table}" c 
        LEFT JOIN LATERAL (
          ${(0, csam_report_get_sql_1.selectCoalesceCsamReportsByContactId)('c')}
        ) reports ON true
        LEFT JOIN LATERAL (
          ${(0, referral_get_sql_1.selectCoalesceReferralsByContactId)('c')}
        ) joinedReferrals ON true
        LEFT JOIN LATERAL (
          ${(0, conversation_media_get_sql_1.selectCoalesceConversationMediasByContactId)('c')}
        ) media ON true`;
exports.selectContactsWithRelations = selectContactsWithRelations;
const selectSingleContactByIdSql = (table) => `
      ${(0, exports.selectContactsWithRelations)(table)}
      ${ID_WHERE_CLAUSE}`;
exports.selectSingleContactByIdSql = selectSingleContactByIdSql;
const selectSingleContactByTaskId = (table) => ` 
      ${(0, exports.selectContactsWithRelations)(table)}
      ${TASKID_WHERE_CLAUSE}`;
exports.selectSingleContactByTaskId = selectSingleContactByTaskId;
