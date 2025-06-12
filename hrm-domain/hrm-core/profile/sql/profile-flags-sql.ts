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

import type {
  NewProfileFlagRecord,
  NewProfileFlagRecordCommons,
} from '@tech-matters/hrm-types';
import { pgp } from '../../dbConnection';

export type { NewProfileFlagRecord };

export const insertProfileFlagSql = (
  profileFlag: NewProfileFlagRecord & NewProfileFlagRecordCommons,
) => `
  ${pgp.helpers.insert(
    profileFlag,
    ['accountSid', 'name', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
    'ProfileFlags',
  )}
  RETURNING *
`;

export const updateProfileFlagByIdSql = (
  profileFlag: Pick<NewProfileFlagRecord, 'name'> &
    Pick<NewProfileFlagRecordCommons, 'updatedAt' | 'updatedBy'>,
) => {
  const { updatedAt, updatedBy, name } = profileFlag;
  const profileFlagWithTimestamp = {
    name,
    updatedAt,
    updatedBy,
  };

  return `
    ${pgp.helpers.update(
      profileFlagWithTimestamp,
      ['name', 'updatedAt', 'updatedBy'],
      'ProfileFlags',
    )}
    WHERE id = $<profileId> AND "accountSid" = $<accountSid>
    RETURNING *
  `;
};

export const deleteProfileFlagByIdSql = `DELETE FROM "ProfileFlags" WHERE id = $<profileFlagId> AND "accountSid" = $<accountSid> RETURNING *`;

export const getProfileFlagsByAccountSql = `
  SELECT * FROM "ProfileFlags"
  WHERE "accountSid" = $<accountSid> OR "accountSid" IS NULL
`;

export const getProfileFlagsByIdentifierSql = `
  SELECT DISTINCT pf.* FROM "Identifiers" ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON p2i."identifierId" = ids.id AND p2i."accountSid" = ids."accountSid"
  LEFT JOIN "ProfilesToProfileFlags" p2f ON p2f."profileId" = p2i."profileId" AND p2f."accountSid" = p2i."accountSid"
  LEFT JOIN "ProfileFlags" pf ON pf.id = p2f."profileFlagId" AND (pf."accountSid" = p2f."accountSid" OR pf."accountSid" IS NULL)
  WHERE ids."identifier" = $<identifier> AND ids."accountSid" = $<accountSid>
`;

type AssociateProfileToProfileFlagParams = {
  profileId: number;
  profileFlagId: number;
  validUntil: Date | null;
};
export const associateProfileToProfileFlagSql = (
  association: AssociateProfileToProfileFlagParams &
    Omit<NewProfileFlagRecordCommons, 'createdBy' | 'updatedBy'>,
) => `
  ${pgp.helpers.insert(
    association,
    ['accountSid', 'profileId', 'profileFlagId', 'createdAt', 'updatedAt', 'validUntil'],
    'ProfilesToProfileFlags',
  )}
`;

export const disassociateProfileFromProfileFlagSql = `
  WITH "deleted" AS (
    DELETE FROM "ProfilesToProfileFlags"
    WHERE "profileId" = $<profileId> AND "profileFlagId" = $<profileFlagId> AND "accountSid" = $<accountSid>
    RETURNING *
  )
  SELECT COUNT(*) FROM "deleted";
`;
