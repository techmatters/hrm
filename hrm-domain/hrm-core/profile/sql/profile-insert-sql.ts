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
import {
  NewRecordCommons,
  NewProfileRecord,
  NewIdentifierRecord,
  NewProfileToIdentifierRecord,
} from '@tech-matters/hrm-types';

export type {
  NewRecordCommons,
  NewProfileRecord,
  NewIdentifierRecord,
  NewProfileToIdentifierRecord,
};

export const insertProfileSql = (profile: NewProfileRecord & NewRecordCommons) => `
  ${pgp.helpers.insert(
    profile,
    [
      'accountSid',
      'name',
      'definitionVersion',
      'createdAt',
      'updatedAt',
      'createdBy',
      'updatedBy',
    ],
    'Profiles',
  )}
  RETURNING *
`;

export const insertIdentifierSql = (
  identifier: NewIdentifierRecord & NewRecordCommons,
) => `
${pgp.helpers.insert(
  identifier,
  ['accountSid', 'identifier', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
  'Identifiers',
)}
RETURNING *
`;

export const associateProfileToIdentifierSql = (
  profileToIdentifier: NewProfileToIdentifierRecord & {
    accountSid: string;
    createdAt: Date;
    updatedAt: Date;
  },
) => `
${pgp.helpers.insert(
  profileToIdentifier,
  ['profileId', 'identifierId', 'accountSid', 'createdAt', 'updatedAt'],
  'ProfilesToIdentifiers',
)}
`;
