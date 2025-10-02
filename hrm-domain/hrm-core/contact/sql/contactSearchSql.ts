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

import { selectCoalesceConversationMediasByContactId } from '../../conversation-media/sql/conversation-media-get-sql';
import { selectCoalesceCsamReportsByContactId } from '../../csam-report/sql/csam-report-get-sql';
import { selectCoalesceReferralsByContactId } from '../../referral/sql/referral-get-sql';
import { TKConditionsSets } from '../../permissions/rulesMap';
import {
  ContactListCondition,
  listContactsPermissionWhereClause,
} from './contactPermissionSql';

const selectSearchContactBaseQuery = (whereClause: string, includeTotal = true) => `
  SELECT 
  ${includeTotal ? `(count(*) OVER())::INTEGER AS "totalCount",` : ''}
  contacts.*, reports."csamReports", "joinedReferrals"."referrals", media."conversationMedia"
  FROM "Contacts" "contacts"
  LEFT JOIN LATERAL (
    ${selectCoalesceCsamReportsByContactId('contacts')}
  ) "reports" ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceReferralsByContactId('contacts')}
  ) "joinedReferrals" ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceConversationMediasByContactId('contacts')}
  ) "media" ON true

  ${whereClause}

  ORDER BY "contacts"."timeOfContact" DESC
    OFFSET $<offset>
    LIMIT $<limit>
`;

export const selectContactsByProfileId = (
  viewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
) =>
  selectSearchContactBaseQuery(`
    WHERE contacts."accountSid" = $<accountSid>
    AND ${listContactsPermissionWhereClause(
      viewPermissions as ContactListCondition[][],
      userIsSupervisor,
    )}
    AND contacts."profileId" = $<profileId>
    AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
    AND ($<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>)
  `);

export const getContactsByIds = (
  viewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
): string => {
  return selectSearchContactBaseQuery(`
        WHERE contacts."accountSid" = $<accountSid>
        AND ${listContactsPermissionWhereClause(
          viewPermissions as ContactListCondition[][],
          userIsSupervisor,
        )}
        AND contacts."id" = ANY($<contactIds>::INTEGER[])
      `);
};

export const SELECT_CONTACTS_TO_RENOTIFY = `
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
    ${selectCoalesceCsamReportsByContactId('contacts')}
  ) "reports" ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceReferralsByContactId('contacts')}
  ) "joinedReferrals" ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceConversationMediasByContactId('contacts')}
  ) "media" ON true
  WHERE contacts."accountSid" = $<accountSid> AND "contacts"."updatedAt" BETWEEN $<dateFrom> AND $<dateTo>
  `;
