import { pgp } from '../connection-pool';
// eslint-disable-next-line prettier/prettier
import type { CaseSectionRecord } from './case-data-access';


export const caseSectionUpsertSql = (sections: CaseSectionRecord[]): string =>
  `${pgp.helpers.insert(
    sections,
    ['caseId', 'sectionType', 'sectionId', 'createdBy', 'createdAt', 'sectionTypeSpecificData'],
    'CaseSections',
  )} 
  ON CONFLICT ON CONSTRAINT "CaseSections_pkey" 
  DO UPDATE SET "updatedBy" = EXCLUDED."createdBy", "updatedAt" = EXCLUDED."createdAt", "sectionTypeSpecificData" = EXCLUDED."sectionTypeSpecificData"`;

export const deleteMissingCaseSectionsSql = (idsByType: Record<string, string[]>): string => {
  const idsByTypeEntries = Object.entries(idsByType)
    .filter(([ ,ids]) =>ids.length);
  if (idsByTypeEntries.length) {
    const sectionTypeWhereExpression = pgp.as.format(
      idsByTypeEntries
        .map(([type, ids]) =>
          pgp.as.format(`"sectionType" = $<type> AND "sectionId" IN ($<ids:csv>)`, { type, ids }),
        )
        .join(' OR '),
    );
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND NOT (${sectionTypeWhereExpression})`;
  } else {
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId>`;
  }
};
