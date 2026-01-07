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
import type { NewProfileRecord, NewRecordCommons } from './profile-insert-sql';

const VALID_PROFILE_UPDATE_FIELDS = ['name', 'updatedAt', 'updatedBy'];

const updateColumnSet = new pgp.helpers.ColumnSet(
  VALID_PROFILE_UPDATE_FIELDS.map(f => ({
    name: f,
    skip: val => !val.exists,
  })),
  { table: 'Profiles' },
);

export const updateProfileByIdSql = (
  profile: Partial<NewProfileRecord> & Pick<NewRecordCommons, 'updatedAt' | 'updatedBy'>,
) => `
    ${pgp.helpers.update(profile, updateColumnSet)}
    WHERE "accountSid" = $<accountSid> AND "id" = $<profileId>
    RETURNING *
  `;

export const TOUCH_PROFILE_SQL = `
  UPDATE "Profiles" 
  SET 
    "updatedAt" = CURRENT_TIMESTAMP,
    "updatedBy" = $<updatedBy>
  WHERE "accountSid" = $<accountSid> AND "id" = $<profileId>
`;
