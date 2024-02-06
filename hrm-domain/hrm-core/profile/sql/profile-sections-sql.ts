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
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProfileSectionRecord = {
  sectionType: string;
  profileId: number;
  content: string;
};

export const insertProfileSectionSql = (
  profileSection: NewProfileSectionRecord & NewRecordCommons,
) => `
  ${pgp.helpers.insert(
    profileSection,
    [
      'sectionType',
      'profileId',
      'content',
      'accountSid',
      'createdBy',
      'updatedBy',
      'createdAt',
      'updatedAt',
    ],
    'ProfileSections',
  )}
  RETURNING *
`;

const WHERE_ID_AND_PROFILE_CLAUSE =
  'WHERE id = $<sectionId> AND "profileId" = $<profileId> AND "accountSid" = $<accountSid>';

export const updateProfileSectionByIdSql = `
  UPDATE "ProfileSections" SET
    "content" = $<content>,
    "updatedBy" = $<updatedBy>,
    "updatedAt" = $<updatedAt>
  ${WHERE_ID_AND_PROFILE_CLAUSE}
  RETURNING *;
`;

export const getProfileSectionByIdSql = `
  SELECT * FROM "ProfileSections"
  ${WHERE_ID_AND_PROFILE_CLAUSE}
`;
