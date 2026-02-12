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
exports.SELECT_CONTACTS_TO_RENOTIFY = exports.getContactsByIds = exports.selectContactsByProfileId = void 0;
const conversation_media_get_sql_1 = require("../../conversation-media/sql/conversation-media-get-sql");
const csam_report_get_sql_1 = require("../../csam-report/sql/csam-report-get-sql");
const referral_get_sql_1 = require("../../referral/sql/referral-get-sql");
const contactPermissionSql_1 = require("./contactPermissionSql");
const selectSearchContactBaseQuery = (whereClause, includeTotal = true) => `
  SELECT 
  ${includeTotal ? `(count(*) OVER())::INTEGER AS "totalCount",` : ''}
  contacts.*, reports."csamReports", "joinedReferrals"."referrals", media."conversationMedia"
  FROM "Contacts" "contacts"
  LEFT JOIN LATERAL (
    ${(0, csam_report_get_sql_1.selectCoalesceCsamReportsByContactId)('contacts')}
  ) "reports" ON true
  LEFT JOIN LATERAL (
    ${(0, referral_get_sql_1.selectCoalesceReferralsByContactId)('contacts')}
  ) "joinedReferrals" ON true
  LEFT JOIN LATERAL (
    ${(0, conversation_media_get_sql_1.selectCoalesceConversationMediasByContactId)('contacts')}
  ) "media" ON true

  ${whereClause}

  ORDER BY "contacts"."timeOfContact" DESC
    OFFSET $<offset>
    LIMIT $<limit>
`;
const selectContactsByProfileId = (viewPermissions, userIsSupervisor) => selectSearchContactBaseQuery(`
    WHERE contacts."accountSid" = $<accountSid>
    AND ${(0, contactPermissionSql_1.listContactsPermissionWhereClause)(viewPermissions, userIsSupervisor)}
    AND contacts."profileId" = $<profileId>
    AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
    AND ($<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>)
  `);
exports.selectContactsByProfileId = selectContactsByProfileId;
const getContactsByIds = (viewPermissions, userIsSupervisor) => {
    return selectSearchContactBaseQuery(`
        WHERE contacts."accountSid" = $<accountSid>
        AND ${(0, contactPermissionSql_1.listContactsPermissionWhereClause)(viewPermissions, userIsSupervisor)}
        AND contacts."id" = ANY($<contactIds>::INTEGER[])
      `);
};
exports.getContactsByIds = getContactsByIds;
exports.SELECT_CONTACTS_TO_RENOTIFY = `
  SELECT
    "contacts"."id"::text AS "id",
    "contacts"."createdAt", 
    "contacts"."updatedAt", 
    "contacts"."rawJson", 
    "contacts"."queueName", 
    "contacts"."twilioWorkerId", 
    "contacts"."helpline", 
    "contacts"."number", 
    "contacts"."channel", 
    "contacts"."conversationDuration", 
    (CASE WHEN "contacts"."caseId" IS NOT NULL THEN "contacts"."caseId"::text ELSE NULL END) AS "caseId", 
    "contacts"."accountSid", 
    "contacts"."timeOfContact", 
    "contacts"."taskId", 
    "contacts"."createdBy",
    "contacts"."channelSid",
    "contacts"."serviceSid",
    "contacts"."updatedBy",
    "contacts"."finalizedAt",
    "contacts"."profileId",
    "contacts"."identifierId", 
    "contacts"."definitionVersion",
    reports."csamReports", 
    "joinedReferrals"."referrals", 
    media."conversationMedia"
  FROM "Contacts" "contacts"
  LEFT JOIN LATERAL (
    ${(0, csam_report_get_sql_1.selectCoalesceCsamReportsByContactId)('contacts')}
  ) "reports" ON true
  LEFT JOIN LATERAL (
    ${(0, referral_get_sql_1.selectCoalesceReferralsByContactId)('contacts')}
  ) "joinedReferrals" ON true
  LEFT JOIN LATERAL (
    ${(0, conversation_media_get_sql_1.selectCoalesceConversationMediasByContactId)('contacts')}
  ) "media" ON true
  WHERE contacts."accountSid" = $<accountSid> AND "contacts"."updatedAt" BETWEEN $<dateFrom> AND $<dateTo>
  `;
