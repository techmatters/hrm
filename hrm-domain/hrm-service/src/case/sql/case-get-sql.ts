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

export const selectSingleCaseByIdSql = (tableName: string) => `SELECT
      cases.*,
      caseSections."caseSections",
      contacts."connectedContacts"
      FROM "${tableName}" AS cases
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts."caseId" IS NOT NULL), '[]') AS "connectedContacts"
        FROM "permittedFullContacts"(cases."accountSid", NULL) AS contacts 
        WHERE contacts."caseId" = cases.id
      ) contacts ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs."createdAt"), '[]') AS  "caseSections"
        FROM "CaseSections" cs
        WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"
      ) caseSections ON true
      ${ID_WHERE_CLAUSE}`;
