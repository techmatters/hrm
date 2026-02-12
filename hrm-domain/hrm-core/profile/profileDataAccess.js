"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamProfileForRenotifying = exports.getProfileSectionById = exports.updateProfileSectionById = exports.createProfileSection = exports.createProfileFlag = exports.getProfileFlagsByIdentifier = exports.deleteProfileFlagById = exports.updateProfileFlagById = exports.getProfileFlagsForAccount = exports.disassociateProfileFromProfileFlag = exports.associateProfileToProfileFlag = exports.listProfiles = exports.getProfileById = exports.associateProfileToIdentifier = exports.updateProfileById = exports.createProfile = exports.createIdentifier = exports.getIdentifierWithProfiles = void 0;
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
const profile_insert_sql_1 = require("./sql/profile-insert-sql");
const profile_flags_sql_1 = require("./sql/profile-flags-sql");
const sql_1 = require("../sql");
const profileGetSql = __importStar(require("./sql/profile-get-sql"));
const profile_sections_sql_1 = require("./sql/profile-sections-sql");
const profile_list_sql_1 = require("./sql/profile-list-sql");
const search_1 = require("../search");
const profileUpdate_sql_1 = require("./sql/profileUpdate.sql");
const types_1 = require("@tech-matters/types");
const dbConnection_1 = require("../dbConnection");
const pg_query_stream_1 = __importDefault(require("pg-query-stream"));
const profileRenotifyStreamSql_1 = require("./sql/profileRenotifyStreamSql");
const getIdentifierWithProfiles = (task) => async ({ accountSid, identifier, identifierId, }) => {
    const params = { accountSid, identifier, identifierId };
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        /* We run two queries here, one to get the identifier and one to get the profiles
             because writing a single PERFORMANT query against tables that could eventually
             have millions of rows is hard. There is probably a better way to do this...
             but dev time is limited and this works for now.
  
             If you are thinking of changing this, please profile against a db with millions
             of rows in the tables and make sure it is performant.
          */
        const identifierData = await t.oneOrNone(profileGetSql.getIdentifierSql, params);
        if (!identifierData) {
            return null;
        }
        const profiles = (await t.manyOrNone(profileGetSql.getProfilesByIdentifierSql, params)) || [];
        return {
            ...identifierData,
            profiles,
        };
    });
};
exports.getIdentifierWithProfiles = getIdentifierWithProfiles;
const createIdentifier = (task) => async (accountSid, identifier) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const now = new Date().toISOString();
    const statement = (0, profile_insert_sql_1.insertIdentifierSql)({
        ...identifier,
        createdAt: now,
        updatedAt: now,
        accountSid,
        updatedBy: null,
    });
    return (0, sql_1.txIfNotInOne)(db, task, conn => conn.one(statement));
};
exports.createIdentifier = createIdentifier;
const createProfile = (task) => async (accountSid, profile) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const now = new Date().toISOString();
    const statement = (0, profile_insert_sql_1.insertProfileSql)({
        ...profile,
        createdAt: now,
        updatedAt: now,
        accountSid,
        updatedBy: null,
    });
    return (0, sql_1.txIfNotInOne)(db, task, t => t.one(statement));
};
exports.createProfile = createProfile;
const updateProfileById = (task) => async (accountSid, payload) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const { id, name, updatedBy } = payload;
    const now = new Date().toISOString();
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        return t.oneOrNone((0, profileUpdate_sql_1.updateProfileByIdSql)({ name: name, updatedAt: now, updatedBy }), {
            profileId: id,
            accountSid,
        });
    });
};
exports.updateProfileById = updateProfileById;
const associateProfileToIdentifier = task => async (accountSid, profileId, identifierId) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        const now = new Date();
        await t.none((0, profile_insert_sql_1.associateProfileToIdentifierSql)({
            accountSid,
            profileId,
            identifierId,
            createdAt: now,
            updatedAt: now,
        }));
        return (0, exports.getIdentifierWithProfiles)(t)({
            accountSid,
            identifierId,
        });
    });
};
exports.associateProfileToIdentifier = associateProfileToIdentifier;
const getProfileById = (task) => async (accountSid, profileId, includeSectionContents) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        return t.oneOrNone(profileGetSql.getProfileByIdSql(includeSectionContents), {
            accountSid,
            profileId,
        });
    });
};
exports.getProfileById = getProfileById;
const listProfiles = async (accountSid, listConfiguration, { filters }) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const { limit, offset, sortBy, sortDirection } = (0, search_1.getPaginationElements)(listConfiguration);
    const orderClause = [{ sortBy, sortDirection }];
    const { count, rows } = await db.task(async (connection) => {
        const result = await connection.any((0, profile_list_sql_1.listProfilesSql)(filters || {}, orderClause), {
            accountSid,
            limit,
            offset,
            ...filters,
        });
        const totalCount = result.length ? result[0].totalCount : 0;
        return { rows: result, count: totalCount };
    });
    return { profiles: rows, count };
};
exports.listProfiles = listProfiles;
const associateProfileToProfileFlag = (task) => async (accountSid, profileId, profileFlagId, validUntil, { user }) => {
    const now = new Date().toISOString();
    return (0, types_1.ensureRejection)(async (work) => (0, sql_1.txIfNotInOne)(await (0, dbConnection_1.getDbForAccount)(accountSid), task, work))(async (t) => {
        try {
            await t.none((0, profile_flags_sql_1.associateProfileToProfileFlagSql)({
                accountSid,
                profileId,
                profileFlagId,
                createdAt: now,
                updatedAt: now,
                validUntil,
            }));
            await t.none(profileUpdate_sql_1.TOUCH_PROFILE_SQL, {
                updatedBy: user.workerSid,
                accountSid,
                profileId,
            });
            const profile = await (0, exports.getProfileById)(t)(accountSid, profileId, true);
            return (0, types_1.newOkFromData)(profile);
        }
        catch (e) {
            console.error(e);
            const errorResult = (0, sql_1.inferPostgresErrorResult)(e);
            if ((0, sql_1.isDatabaseForeignKeyViolationErrorResult)(errorResult)) {
                if (errorResult.constraint ===
                    'ProfilesToProfileFlags_profileFlagId_ProfileFlags_id_fk') {
                    return (0, types_1.newErr)({
                        error: 'ProfileFlagNotFoundError',
                        message: `[${accountSid}] Profile flag with id ${profileFlagId} not found - trying to set for profile ${profileId}.`,
                    });
                }
                if (errorResult.constraint === 'ProfilesToProfileFlags_profileId_Profiles_id_fk') {
                    return (0, types_1.newErr)({
                        error: 'ProfileNotFoundError',
                        message: `[${accountSid}] Profile with id ${profileId} not found - when trying to set flag ${profileFlagId} on it.`,
                    });
                }
            }
            if ((0, sql_1.isDatabaseUniqueConstraintViolationErrorResult)(errorResult)) {
                return (0, types_1.newErr)({
                    error: 'ProfileAlreadyFlaggedError',
                    message: `[${accountSid}] Profile with id ${profileId} already has flag ${profileFlagId} set on it.`,
                });
            }
            return errorResult;
        }
    });
};
exports.associateProfileToProfileFlag = associateProfileToProfileFlag;
const disassociateProfileFromProfileFlag = (task) => async (accountSid, profileId, profileFlagId, { user }) => (0, sql_1.txIfNotInOne)(await (0, dbConnection_1.getDbForAccount)(accountSid), task, async (t) => {
    const { count } = await t.oneOrNone(profile_flags_sql_1.disassociateProfileFromProfileFlagSql, {
        accountSid,
        profileId,
        profileFlagId,
    });
    if (Boolean(parseInt(count, 10))) {
        await t.none(profileUpdate_sql_1.TOUCH_PROFILE_SQL, {
            updatedBy: user.workerSid,
            accountSid,
            profileId,
        });
    }
    return (0, exports.getProfileById)(t)(accountSid, profileId, true);
});
exports.disassociateProfileFromProfileFlag = disassociateProfileFromProfileFlag;
const getProfileFlagsForAccount = async (accountSid) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (t) => t.manyOrNone(profile_flags_sql_1.getProfileFlagsByAccountSql, { accountSid }));
};
exports.getProfileFlagsForAccount = getProfileFlagsForAccount;
const updateProfileFlagById = async (accountSid, payload) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const { id, name, updatedBy } = payload;
    const now = new Date().toISOString();
    return db.task(async (t) => {
        return t.oneOrNone((0, profile_flags_sql_1.updateProfileFlagByIdSql)({ name, updatedAt: now, updatedBy }), {
            profileId: id,
            accountSid,
        });
    });
};
exports.updateProfileFlagById = updateProfileFlagById;
const deleteProfileFlagById = async (profileFlagId, accountSid) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (t) => t.oneOrNone(profile_flags_sql_1.deleteProfileFlagByIdSql, {
        accountSid,
        profileFlagId,
    }));
};
exports.deleteProfileFlagById = deleteProfileFlagById;
const getProfileFlagsByIdentifier = async (accountSid, identifier) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return db.task(async (t) => t.manyOrNone(profile_flags_sql_1.getProfileFlagsByIdentifierSql, { accountSid, identifier }));
};
exports.getProfileFlagsByIdentifier = getProfileFlagsByIdentifier;
const createProfileFlag = async (accountSid, payload) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const now = new Date().toISOString();
    const statement = (0, profile_flags_sql_1.insertProfileFlagSql)({
        name: payload.name,
        createdAt: now,
        createdBy: payload.createdBy,
        updatedAt: now,
        updatedBy: payload.createdBy,
        accountSid,
    });
    return db.task(async (t) => t.one(statement));
};
exports.createProfileFlag = createProfileFlag;
const createProfileSection = (task) => async (accountSid, payload) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const now = new Date().toISOString();
    const statement = (0, profile_sections_sql_1.insertProfileSectionSql)({
        ...payload,
        createdAt: now,
        updatedAt: now,
        accountSid,
        createdBy: payload.createdBy,
        updatedBy: null,
    });
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        const section = await t.oneOrNone(statement);
        if (section) {
            // trigger an update on profiles
            await t.none(profileUpdate_sql_1.TOUCH_PROFILE_SQL, {
                updatedBy: payload.createdBy,
                profileId: payload.profileId,
                accountSid,
            });
        }
        return section;
    });
};
exports.createProfileSection = createProfileSection;
const updateProfileSectionById = (task) => async (accountSid, payload) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const now = new Date();
    return (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        const section = await t.oneOrNone(profile_sections_sql_1.updateProfileSectionByIdSql, {
            accountSid,
            profileId: payload.profileId,
            sectionId: payload.sectionId,
            content: payload.content,
            updatedBy: payload.updatedBy,
            updatedAt: now,
        });
        if (section) {
            // trigger an update on profiles
            await t.none(profileUpdate_sql_1.TOUCH_PROFILE_SQL, {
                updatedBy: payload.updatedBy,
                profileId: payload.profileId,
                accountSid,
            });
        }
        return section;
    });
};
exports.updateProfileSectionById = updateProfileSectionById;
const getProfileSectionById = async (accountSid, { profileId, sectionId }) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (t) => t.oneOrNone(profile_sections_sql_1.getProfileSectionByIdSql, { accountSid, profileId, sectionId }));
exports.getProfileSectionById = getProfileSectionById;
const streamProfileForRenotifying = async ({ accountSid, filters: { dateTo, dateFrom }, batchSize, }) => {
    const sql = dbConnection_1.pgp.as.format((0, profileRenotifyStreamSql_1.getProfilesToRenotifySql)(), { accountSid, dateTo, dateFrom });
    console.debug(sql);
    const qs = new pg_query_stream_1.default(sql, [], {
        batchSize,
    });
    console.debug('qs:', qs);
    const db = await Promise.resolve((0, dbConnection_1.getDbForAdmin)());
    // Expose the readable stream to the caller as a promise for further pipelining
    console.debug('db:', db);
    return new Promise(resolve => {
        db.stream(qs, resultStream => {
            resolve(resultStream);
        });
    });
};
exports.streamProfileForRenotifying = streamProfileForRenotifying;
