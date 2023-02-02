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
// eslint-disable-next-line prettier/prettier
import { CaseSectionRecord } from '../case-data-access';

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

export const deleteMissingCaseSectionsSql = (idsByType: Record<string, string[]>): string => {
  const idsByTypeEntries = Object.entries(idsByType).filter(([, ids]) => ids.length);
  if (idsByTypeEntries.length) {
    const sectionTypeWhereExpression = pgp.as.format(
      idsByTypeEntries
        .map(([type, ids]) =>
          pgp.as.format(`"sectionType" = $<type> AND "sectionId" IN ($<ids:csv>)`, { type, ids }),
        )
        .join(' OR '),
    );
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND "accountSid" = $<accountSid> AND NOT (${sectionTypeWhereExpression})`;
  } else {
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND "accountSid" = $<accountSid>`;
  }
};
