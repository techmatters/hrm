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
import * as sql from '../../sql';
import { constants } from './constants';

const ID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."id" = $<contactId>`;
const TASKID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."taskId" = $<taskId>`;

export const contactListPropertiesSql = sql.fieldListToSql(
  constants.table,
  constants.listProperties,
);
export const contactListRawJsonBuildObjectSql = sql.objectNotationToBuildObjectSql(
  constants.table,
  'rawJson',
  constants.listRawJsonProperties,
);

export const selectContactsWithRelations = (table: string) => `
        SELECT c.*, reports."csamReports", joinedReferrals."referrals", media."conversationMedia"
        FROM "${table}" c
        LEFT JOIN LATERAL (
          ${selectCoalesceCsamReportsByContactId('c')}
        ) reports ON true
        LEFT JOIN LATERAL (
          ${selectCoalesceReferralsByContactId('c')}
        ) joinedReferrals ON true
        LEFT JOIN LATERAL (
          ${selectCoalesceConversationMediasByContactId('c')}
        ) media ON true`;

export const selectSingleContactByIdSql = (table: string) => `
      ${selectContactsWithRelations(table)}
      ${ID_WHERE_CLAUSE}`;

export const selectSingleContactByTaskId = (table: string) => `
      ${selectContactsWithRelations(table)}
      ${TASKID_WHERE_CLAUSE}`;
