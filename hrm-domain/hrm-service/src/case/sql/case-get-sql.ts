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

import { selectCoalesceCsamReportsByContactId } from '../../csam-report/sql/csam-report-get-sql';
import { selectCoalesceReferralsByContactId } from '../../referral/sql/referral-get-sql';

const ID_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`;

export const selectSingleCaseByIdSql = (tableName: string) => `SELECT
      cases.*,
      caseSections."caseSections",
      contacts."connectedContacts"
      FROM "${tableName}" AS cases
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(c) || to_jsonb(joinedReports) || to_jsonb(joinedReferrals)), '[]') AS  "connectedContacts"
        FROM "Contacts" c 
        LEFT JOIN LATERAL (
          ${selectCoalesceCsamReportsByContactId('c')}
        ) joinedReports ON true
        LEFT JOIN LATERAL (
          ${selectCoalesceReferralsByContactId('c')}
        ) joinedReferrals ON true
        WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
      ) contacts ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs."createdAt"), '[]') AS  "caseSections"
        FROM "CaseSections" cs
        WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"
      ) caseSections ON true
      ${ID_WHERE_CLAUSE}`;