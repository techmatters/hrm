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

type NewRecordCommons = {
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProfileFlagRecord = {
  name: string;
};

export const insertProfileFlagSql = (
  profileFlag: NewProfileFlagRecord & NewRecordCommons,
) => `
  ${pgp.helpers.insert(
    profileFlag,
    ['accountSid', 'name', 'createdAt', 'updatedAt'],
    'ProfileFlags',
  )}
  RETURNING *
`;

export const getProfileFlagsByAccountSql = `
  SELECT * FROM "ProfileFlags"
  WHERE "accountSid" = $<accountSid> OR "accountSid" IS NULL
`;

type AssociateProfileToProfileFlagParams = {
  profileId: number;
  profileFlagId: number;
};
export const associateProfileToProfileFlagSql = (
  association: AssociateProfileToProfileFlagParams & NewRecordCommons,
) => `
  ${pgp.helpers.insert(
    association,
    ['accountSid', 'profileId', 'profileFlagId', 'createdAt', 'updatedAt'],
    'ProfilesToProfileFlags',
  )}
`;

export const disassociateProfileFromProfileFlagSql = `
  DELETE FROM "ProfilesToProfileFlags"
  WHERE "profileId" = $<profileId> AND "profileFlagId" = $<profileFlagId> AND "accountSid" = $<accountSid>
`;
