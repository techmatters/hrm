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
