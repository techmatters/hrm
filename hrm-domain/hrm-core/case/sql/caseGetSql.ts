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
} from '../../contact/sql/contactPermissionSql';

const ID_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`;

export const selectContactsOwnedCount = (ownerVariableName: string) =>
  `SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<${ownerVariableName}>`;

const leftJoinLateralContacts = (
  viewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
  onlyEssentialData?: boolean,
) => {
  if (onlyEssentialData) {
    return `
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]') AS  "connectedContacts"
        FROM "Contacts" c 
        WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
        AND ${listContactsPermissionWhereClause(
          viewPermissions as ContactListCondition[][],
          userIsSupervisor,
          'c',
        )}
        AND c."timeOfContact" = (
          SELECT MIN("timeOfContact")
          FROM "Contacts" c2
          WHERE c2."caseId" = cases.id AND c2."accountSid" = cases."accountSid"
          AND ${listContactsPermissionWhereClause(
            viewPermissions as ContactListCondition[][],
            userIsSupervisor,
            'c2',
          )}
        )
          
      ) "contacts" ON true`;
  }

  return `
    LEFT JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) || to_jsonb("joinedReports") || to_jsonb("joinedReferrals") || to_jsonb("joinedConversationMedia") ORDER BY c."timeOfContact"), '[]') AS  "connectedContacts"
      FROM "Contacts" c 
      LEFT JOIN LATERAL (
        ${selectCoalesceCsamReportsByContactId('c')}
      ) "joinedReports" ON true
      LEFT JOIN LATERAL (
        ${selectCoalesceReferralsByContactId('c')}
      ) "joinedReferrals" ON true
      LEFT JOIN LATERAL (
        ${selectCoalesceConversationMediasByContactId('c')}
      ) "joinedConversationMedia" ON true
      WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
        AND ${listContactsPermissionWhereClause(
          viewPermissions as ContactListCondition[][],
          userIsSupervisor,
          'c',
        )}
      
    ) "contacts" ON true`;
};

/**
 * Should remove "contactsOwnedCount" when onlyEssentialData?
 * Or is it used for permissions?
 */
export const selectSingleCaseByIdSql = (
  tableName: string,
  contactViewPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
  onlyEssentialData?: boolean,
) => `SELECT
      "cases".*,
      "caseSections"."caseSections",
      "contacts"."connectedContacts",
      "contactsOwnedCount"."contactsOwnedByUserCount"
      FROM "${tableName}" AS "cases"
      ${leftJoinLateralContacts(
        contactViewPermissions,
        userIsSupervisor,
        onlyEssentialData,
      )}
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs."createdAt"), '[]') AS  "caseSections"
        FROM "CaseSections" cs
        WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"
      ) "caseSections" ON true
      LEFT JOIN LATERAL (
        ${selectContactsOwnedCount('twilioWorkerSid')}
      ) "contactsOwnedCount" ON true
      ${ID_WHERE_CLAUSE}`;
