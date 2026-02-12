"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileSectionByIdSql = exports.updateProfileSectionByIdSql = exports.insertProfileSectionSql = void 0;
const dbConnection_1 = require("../../dbConnection");
const insertProfileSectionSql = (profileSection) => `
  ${dbConnection_1.pgp.helpers.insert(profileSection, [
    'sectionType',
    'profileId',
    'content',
    'accountSid',
    'createdBy',
    'updatedBy',
    'createdAt',
    'updatedAt',
], 'ProfileSections')}
  RETURNING *
`;
exports.insertProfileSectionSql = insertProfileSectionSql;
const WHERE_ID_AND_PROFILE_CLAUSE = 'WHERE id = $<sectionId> AND "profileId" = $<profileId> AND "accountSid" = $<accountSid>';
exports.updateProfileSectionByIdSql = `
  UPDATE "ProfileSections" SET
    "content" = $<content>,
    "updatedBy" = $<updatedBy>,
    "updatedAt" = $<updatedAt>
  ${WHERE_ID_AND_PROFILE_CLAUSE}
  RETURNING *;
`;
exports.getProfileSectionByIdSql = `
  SELECT * FROM "ProfileSections"
  ${WHERE_ID_AND_PROFILE_CLAUSE}
`;
