import { pgp } from '../../connection-pool';
import { selectSingleCaseByIdSql } from './case-get-sql';

const VALID_CASE_UPDATE_FIELDS = ['info', 'status', 'updatedAt', 'updatedBy'];

const updateCaseColumnSet = new pgp.helpers.ColumnSet(
  VALID_CASE_UPDATE_FIELDS.map(f => ({
    name: f,
    skip: val => !val.exists,
  })),
  { table: 'Cases' },
);

export const updateByIdSql = (updatedValues: Record<string, unknown>) => `WITH updated AS (
        ${pgp.helpers.update(updatedValues, updateCaseColumnSet)} 
          WHERE "Cases"."accountSid" = $<accountSid> AND "Cases"."id" = $<caseId> 
          RETURNING *
      )
      ${selectSingleCaseByIdSql('updated')}
`;
