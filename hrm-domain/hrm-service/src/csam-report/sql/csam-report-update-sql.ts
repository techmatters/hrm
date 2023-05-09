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

const ID_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id" = $<reportId>`;
const IN_IDS_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id" IN ($<reportIds:csv>)`;

export const updateContactIdByCsamReportIdsSql = `
  UPDATE "CSAMReports"
  SET "contactId" = $<contactId>
  ${IN_IDS_WHERE_CLAUSE}
  RETURNING *
`;

export const updateAcknowledgedByCsamReportIdSql = `
  UPDATE "CSAMReports"
  SET "acknowledged" = $<acknowledged>
  ${ID_WHERE_CLAUSE}
  RETURNING *
`;
