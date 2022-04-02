import { pgp } from '../connection-pool';
// eslint-disable-next-line prettier/prettier
import { CaseSectionRecord } from './case-data-access';

export const SELECT_CASE_SECTIONS = `SELECT cs.*
          FROM "CaseSections" cs
          WHERE cs."caseId" = cases.id`;

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
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId> AND NOT (${sectionTypeWhereExpression})`;
  } else {
    return `DELETE FROM "CaseSections" WHERE "caseId" = $<caseId>`;
  }
};
