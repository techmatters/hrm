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
exports.disassociateProfileFromProfileFlagSql = exports.associateProfileToProfileFlagSql = exports.getProfileFlagsByIdentifierSql = exports.getProfileFlagsByAccountSql = exports.deleteProfileFlagByIdSql = exports.updateProfileFlagByIdSql = exports.insertProfileFlagSql = void 0;
const dbConnection_1 = require("../../dbConnection");
const insertProfileFlagSql = (profileFlag) => `
  ${dbConnection_1.pgp.helpers.insert(profileFlag, ['accountSid', 'name', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'], 'ProfileFlags')}
  RETURNING *
`;
exports.insertProfileFlagSql = insertProfileFlagSql;
const updateProfileFlagByIdSql = (profileFlag) => {
    const { updatedAt, updatedBy, name } = profileFlag;
    const profileFlagWithTimestamp = {
        name,
        updatedAt,
        updatedBy,
    };
    return `
    ${dbConnection_1.pgp.helpers.update(profileFlagWithTimestamp, ['name', 'updatedAt', 'updatedBy'], 'ProfileFlags')}
    WHERE id = $<profileId> AND "accountSid" = $<accountSid>
    RETURNING *
  `;
};
exports.updateProfileFlagByIdSql = updateProfileFlagByIdSql;
exports.deleteProfileFlagByIdSql = `DELETE FROM "ProfileFlags" WHERE id = $<profileFlagId> AND "accountSid" = $<accountSid> RETURNING *`;
exports.getProfileFlagsByAccountSql = `
  SELECT * FROM "ProfileFlags"
  WHERE "accountSid" = $<accountSid> OR "accountSid" IS NULL
`;
exports.getProfileFlagsByIdentifierSql = `
  SELECT DISTINCT pf.* FROM "Identifiers" ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON p2i."identifierId" = ids.id AND p2i."accountSid" = ids."accountSid"
  LEFT JOIN "ProfilesToProfileFlags" p2f ON p2f."profileId" = p2i."profileId" AND p2f."accountSid" = p2i."accountSid"
  LEFT JOIN "ProfileFlags" pf ON pf.id = p2f."profileFlagId" AND (pf."accountSid" = p2f."accountSid" OR pf."accountSid" IS NULL)
  WHERE ids."identifier" = $<identifier> AND ids."accountSid" = $<accountSid>
`;
const associateProfileToProfileFlagSql = (association) => `
  ${dbConnection_1.pgp.helpers.insert(association, ['accountSid', 'profileId', 'profileFlagId', 'createdAt', 'updatedAt', 'validUntil'], 'ProfilesToProfileFlags')}
`;
exports.associateProfileToProfileFlagSql = associateProfileToProfileFlagSql;
exports.disassociateProfileFromProfileFlagSql = `
  WITH "deleted" AS (
    DELETE FROM "ProfilesToProfileFlags"
    WHERE "profileId" = $<profileId> AND "profileFlagId" = $<profileFlagId> AND "accountSid" = $<accountSid>
    RETURNING *
  )
  SELECT COUNT(*) FROM "deleted";
`;
