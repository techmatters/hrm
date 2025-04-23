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

import { pgp } from '../../dbConnection';
import { HrmAccountId } from '@tech-matters/types';

const VALID_CASE_UPDATE_FIELDS = ['info', 'status', 'updatedAt', 'updatedBy'];

const updateCaseColumnSet = new pgp.helpers.ColumnSet(
  VALID_CASE_UPDATE_FIELDS.map(f => ({
    name: f,
    skip: val => !val.exists,
  })),
  { table: 'Cases' },
);

const statusUpdatedSetSql = (parameters: { status?: string; updatedBy?: string }) =>
  parameters.status
    ? pgp.as.format(
        `
        , 
        "statusUpdatedAt" = CASE WHEN "status" = $<status> THEN "statusUpdatedAt" ELSE CURRENT_TIMESTAMP END,
        "statusUpdatedBy" = CASE WHEN "status" = $<status> THEN "statusUpdatedBy" ELSE $<updatedBy> END,
        "previousStatus" = CASE WHEN "status" = $<status> THEN "previousStatus" ELSE "status" END`,
        parameters,
      )
    : '';

export const updateByIdSql = (
  updatedValues: Record<string, unknown>,
  accountSid: HrmAccountId,
  caseId: string,
) => `
        ${pgp.helpers.update(updatedValues, updateCaseColumnSet)} 
        ${statusUpdatedSetSql(updatedValues)}
        ${pgp.as.format(
          `WHERE "Cases"."accountSid" = $<accountSid> AND "Cases"."id" = $<caseId> RETURNING *`,
          {
            accountSid,
            caseId,
          },
        )} 
`;

export const PATCH_CASE_INFO_BY_ID = `
UPDATE "Cases" SET 
  "info" = "info" || $<infoPatch>::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP,
  "updatedBy" = $<updatedBy>
WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>
RETURNING *`;

export const TOUCH_CASE_SQL = `
UPDATE "Cases" 
SET 
  "updatedAt" = CURRENT_TIMESTAMP,
  "updatedBy" = $<updatedBy>
WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>
`;
