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
  createdAt?: Date;
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

export const updateProfileFlagByIdSql = (
  profileFlag: NewProfileFlagRecord &
    NewRecordCommons & { id: number; accountSid: string },
) => {
  const { id, accountSid, updatedAt, ...rest } = profileFlag;
  const profileFlagWithTimestamp = {
    ...rest,
    updatedAt: updatedAt.toISOString(),
  };

  return (
    pgp.helpers.update(profileFlagWithTimestamp, ['name', 'updatedAt'], 'ProfileFlags') +
    `WHERE id = ${id} AND "accountSid" = '${accountSid}'
      RETURNING *`
  );
};

export const deleteProfileFlagByIdSql = ({
  profileFlagId,
  accountSid,
}: {
  profileFlagId: number;
  accountSid: string;
}) => {
  return `DELETE FROM "ProfileFlags" WHERE id = ${profileFlagId} AND "accountSid" = '${accountSid}' RETURNING *`;
};

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
// WHERE ids."identifier" = '190.2.98.203' -- AND ids."accountSid" = ''

type AssociateProfileToProfileFlagParams = {
  profileId: number;
  profileFlagId: number;
  validUntil: Date | null;
};
export const associateProfileToProfileFlagSql = (
  association: AssociateProfileToProfileFlagParams & NewRecordCommons,
) => `
  ${pgp.helpers.insert(
    association,
    ['accountSid', 'profileId', 'profileFlagId', 'createdAt', 'updatedAt', 'validUntil'],
    'ProfilesToProfileFlags',
  )}
`;

export const disassociateProfileFromProfileFlagSql = `
  DELETE FROM "ProfilesToProfileFlags"
  WHERE "profileId" = $<profileId> AND "profileFlagId" = $<profileFlagId> AND "accountSid" = $<accountSid>
`;
