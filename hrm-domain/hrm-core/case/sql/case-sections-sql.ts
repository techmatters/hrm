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

import { pgp } from '../../connection-pool';
import { CaseSectionRecord } from '../caseDataAccess';

/**
 * Is this FILTER (WHERE cs."caseId" IS NOT NULL) needed? Won't cs."caseId" always be not null as "caseId" is part of the PK?
 */
export const SELECT_CASE_SECTIONS = `SELECT
         COALESCE(jsonb_agg(DISTINCT cs.*) FILTER (WHERE cs."caseId" IS NOT NULL), '[]') AS "caseSections"
                     FROM "CaseSections" cs
                     WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"`;

export const caseSectionUpsertSql = (sections: CaseSectionRecord[]): string =>
  `${pgp.helpers.insert(
    sections,
    [
      'caseId',
      'sectionType',
      'sectionId',
      'createdBy',
      'createdAt',
      'updatedBy',
      'updatedAt',
      'sectionTypeSpecificData',
      'accountSid',
    ],
    'CaseSections',
  )}
  ON CONFLICT ON CONSTRAINT "CaseSections_pkey"
  DO UPDATE SET "createdBy" = EXCLUDED."createdBy", "createdAt" = EXCLUDED."createdAt", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = EXCLUDED."updatedAt", "sectionTypeSpecificData" = EXCLUDED."sectionTypeSpecificData"`;

export const deleteMissingCaseSectionsSql = (
  idsByType: Record<string, string[]>,
): { sql: string; values: Record<string, { ids: string[]; type: string }> } => {
  const idsByTypeEntries = Object.entries(idsByType).filter(([, ids]) => ids.length);
  const deleteValues: Record<string, { ids: string[]; type: string }> = {};
  const whereClauses: string[] = [];
  if (idsByTypeEntries.length) {
    idsByTypeEntries.forEach(([type, ids], index) => {
      whereClauses.push(
        `"sectionType" = $<section_${index}.type> AND "sectionId" IN ($<section_${index}.ids:csv>)`,
      );
      deleteValues[`section_${index}`] = {
        ids,
        type,
      };
    });
    return {
      sql: `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND "accountSid" = $<accountSid> AND NOT (${whereClauses.join(
        ' OR ',
      )})`,
      values: deleteValues,
    };
  } else {
    return {
      sql: `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND "accountSid" = $<accountSid>`,
      values: {},
    };
  }
};
