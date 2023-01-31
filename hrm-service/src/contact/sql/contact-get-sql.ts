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

const ID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."id" = $<contactId>`;
const TASKID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."taskId" = $<taskId>`;

export const selectContactsWithCsamReports = (table: string) => `
        SELECT c.*, reports."csamReports" 
        FROM "${table}" c 
        LEFT JOIN LATERAL (
          ${selectCoalesceCsamReportsByContactId('c')}
        ) reports ON true`;

export const selectSingleContactByIdSql = (table: string) => `
      ${selectContactsWithCsamReports(table)}
      ${ID_WHERE_CLAUSE}`;

export const selectSingleContactByTaskId = (table: string) => ` 
      ${selectContactsWithCsamReports(table)}
      ${TASKID_WHERE_CLAUSE}
      -- only take the latest, this ORDER / LIMIT clause would be redundant 
      ORDER BY c."createdAt" DESC LIMIT 1`;
