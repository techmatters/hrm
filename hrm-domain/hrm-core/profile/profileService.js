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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileSectionById = exports.updateProfileSectionById = exports.createProfileSection = exports.deleteProfileFlagById = exports.updateProfileFlagById = exports.createProfileFlag = exports.getProfileFlagsByIdentifier = exports.getProfileFlags = exports.disassociateProfileFromProfileFlag = exports.associateProfileToProfileFlag = exports.listProfiles = exports.getIdentifierByIdentifier = exports.createProfileWithIdentifierOrError = exports.getOrCreateProfileWithIdentifier = exports.createIdentifierAndProfile = exports.getProfile = void 0;
const types_1 = require("@tech-matters/types");
const date_fns_1 = require("date-fns");
const profileDB = __importStar(require("./profileDataAccess"));
const sql_1 = require("../sql");
const dbConnection_1 = require("../dbConnection");
const profileEntityBroadcast_1 = require("./profileEntityBroadcast");
const getProfile = (task) => async (accountSid, profileId) => {
    return profileDB.getProfileById(task)(accountSid, profileId);
};
exports.getProfile = getProfile;
const createIdentifierAndProfile = (task) => async (accountSid, payload, { user }) => {
    const { identifier, profile } = payload;
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const queryResult = await (0, sql_1.txIfNotInOne)(db, task, async (t) => {
        try {
            const newIdentifier = await profileDB.createIdentifier(t)(accountSid, {
                identifier: identifier.identifier,
                createdBy: user.workerSid,
            });
            const newProfile = await profileDB.createProfile(t)(accountSid, {
                name: profile.name || null,
                createdBy: user.workerSid,
                definitionVersion: profile.definitionVersion,
            });
            const idWithProfiles = await profileDB.associateProfileToIdentifier(t)(accountSid, newProfile.id, newIdentifier.id);
            // trigger an update on profiles to keep track of who associated
            const updatedProfile = await profileDB.updateProfileById(t)(accountSid, {
                id: newProfile.id,
                updatedBy: user.workerSid,
            });
            return (0, types_1.newOk)({ data: { idWithProfiles, updatedProfile } });
        }
        catch (err) {
            return (0, sql_1.inferPostgresErrorResult)(err);
        }
    });
    if ((0, types_1.isOk)(queryResult)) {
        const { updatedProfile, idWithProfiles } = queryResult.data;
        await (0, profileEntityBroadcast_1.notifyCreateProfile)({
            accountSid,
            profileOrId: {
                ...updatedProfile,
                identifiers: [idWithProfiles],
                profileFlags: [],
                profileSections: [],
                hasContacts: false,
            },
        });
        return (0, types_1.newOkFromData)(idWithProfiles);
    }
    return queryResult;
};
exports.createIdentifierAndProfile = createIdentifierAndProfile;
const getOrCreateProfileWithIdentifier = (task) => async (accountSid, payload, { user }) => {
    const { identifier, profile } = payload;
    if (!identifier?.identifier) {
        return null;
    }
    const profileResult = await profileDB.getIdentifierWithProfiles(task)({
        accountSid,
        identifier: identifier.identifier,
    });
    if (profileResult) {
        return (0, types_1.newOk)({ data: { identifier: profileResult, created: false } });
    }
    const createdResult = await (0, exports.createIdentifierAndProfile)(task)(accountSid, { identifier, profile }, { user });
    if ((0, types_1.isOk)(createdResult)) {
        return (0, types_1.newOk)({ data: { identifier: createdResult.data, created: true } });
    }
    else {
        return createdResult;
    }
};
exports.getOrCreateProfileWithIdentifier = getOrCreateProfileWithIdentifier;
const createProfileWithIdentifierOrError = async (accountSid, payload, { user }) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const { identifier, profile } = payload;
    if (!identifier?.identifier) {
        return (0, types_1.newErr)({
            message: 'Missing identifier parameter',
            error: 'InvalidParameterError',
        });
    }
    const result = await (0, types_1.ensureRejection)(db.task)(async (conn) => (0, exports.getOrCreateProfileWithIdentifier)(conn)(accountSid, {
        identifier,
        profile,
    }, { user }));
    if ((0, types_1.isOk)(result)) {
        if (result.data.created === false) {
            return (0, types_1.newErr)({
                message: `Identifier ${identifier} already exists`,
                error: 'IdentifierExistsError',
            });
        }
        return (0, types_1.newOk)({ data: result.data.identifier });
    }
    return result;
};
exports.createProfileWithIdentifierOrError = createProfileWithIdentifierOrError;
const getIdentifierByIdentifier = async (accountSid, identifier) => profileDB.getIdentifierWithProfiles()({
    accountSid,
    identifier: identifier,
});
exports.getIdentifierByIdentifier = getIdentifierByIdentifier;
exports.listProfiles = profileDB.listProfiles;
const associateProfileToProfileFlag = async (accountSid, { profileId, profileFlagId, validUntil, }, { user }) => {
    if (validUntil && !(0, date_fns_1.isFuture)(validUntil)) {
        return (0, types_1.newErr)({
            error: 'InvalidParameterError',
            message: 'Invalid parameter "validUntil", must be a future date',
        });
    }
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const finalResult = await db.task(async (t) => {
        const result = await profileDB.associateProfileToProfileFlag(t)(accountSid, profileId, profileFlagId, validUntil, { user });
        if ((0, types_1.isErr)(result)) {
            if (result.error === 'ProfileNotFoundError') {
                return (0, types_1.newOkFromData)(undefined);
            }
            else if (result.error === 'ProfileFlagNotFoundError') {
                return (0, types_1.newErr)({
                    error: 'InvalidParameterError',
                    message: result.message,
                });
            }
            else if (result.error === 'ProfileAlreadyFlaggedError') {
                return result;
            }
            result.unwrap(); // Q for SJH: This bubbles the error. Is this intentional?
            return;
        }
        return (0, types_1.newOkFromData)(result.data);
    });
    if ((0, types_1.isOk)(finalResult)) {
        await (0, profileEntityBroadcast_1.notifyUpdateProfile)({ accountSid, profileOrId: finalResult.data });
    }
    return finalResult;
};
exports.associateProfileToProfileFlag = associateProfileToProfileFlag;
const disassociateProfileFromProfileFlag = async (accountSid, { profileId, profileFlagId, }, { user }) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const profile = await db.task(async (t) => profileDB.disassociateProfileFromProfileFlag(t)(accountSid, profileId, profileFlagId, { user }));
    await (0, profileEntityBroadcast_1.notifyUpdateProfile)({ accountSid, profileOrId: profile });
    return profile;
};
exports.disassociateProfileFromProfileFlag = disassociateProfileFromProfileFlag;
exports.getProfileFlags = profileDB.getProfileFlagsForAccount;
exports.getProfileFlagsByIdentifier = profileDB.getProfileFlagsByIdentifier;
const createProfileFlag = async (accountSid, payload, { user }) => {
    const { name } = payload;
    const existingFlags = await (0, exports.getProfileFlags)(accountSid);
    const existingFlag = existingFlags.find(flag => flag.name === name);
    if (existingFlag) {
        return (0, types_1.newErr)({
            message: `Flag with name "${name}" already exists`,
            error: 'InvalidParameterError',
        });
    }
    const pf = await profileDB.createProfileFlag(accountSid, {
        name,
        createdBy: user.workerSid,
    });
    return (0, types_1.newOk)({ data: pf });
};
exports.createProfileFlag = createProfileFlag;
// TODO: If we start using this, we either need to add code to automatically broadcast entity updates for all affected profiles, or the code using it has to handle the broadcasts itself
const updateProfileFlagById = async (accountSid, flagId, payload, { user }) => {
    const { name } = payload;
    const existingFlags = await (0, exports.getProfileFlags)(accountSid);
    const existingFlag = existingFlags.find(flag => flag.name === name);
    if (existingFlag) {
        return (0, types_1.newErr)({
            message: `Flag with name "${name}" already exists`,
            error: 'InvalidParameterError',
        });
    }
    const profileFlag = await profileDB.updateProfileFlagById(accountSid, {
        id: flagId,
        name,
        updatedBy: user.workerSid,
    });
    return (0, types_1.newOk)({ data: profileFlag });
};
exports.updateProfileFlagById = updateProfileFlagById;
// TODO: If we start using this, we either need to add code to automatically broadcast entity updates for all associated profiles, or the code using it has to handle the broadcasts itself
const deleteProfileFlagById = async (flagId, accountSid) => profileDB.deleteProfileFlagById(flagId, accountSid);
exports.deleteProfileFlagById = deleteProfileFlagById;
const createProfileSection = async (accountSid, payload, { user }) => {
    const { content, profileId, sectionType } = payload;
    const section = await profileDB.createProfileSection()(accountSid, {
        content,
        profileId,
        sectionType,
        createdBy: user.workerSid,
    });
    await (0, profileEntityBroadcast_1.notifyUpdateProfile)({ accountSid, profileOrId: payload.profileId });
    return section;
};
exports.createProfileSection = createProfileSection;
const updateProfileSectionById = async (accountSid, payload, { user }) => {
    const section = await profileDB.updateProfileSectionById()(accountSid, {
        ...payload,
        updatedBy: user.workerSid,
    });
    if (section) {
        await (0, profileEntityBroadcast_1.notifyUpdateProfile)({ accountSid, profileOrId: payload.profileId });
    }
    return section;
};
exports.updateProfileSectionById = updateProfileSectionById;
// While this is just a wrapper around profileDB.getProfileSectionById, we'll need more code to handle permissions soon
const getProfileSectionById = async (accountSid, payload) => {
    return profileDB.getProfileSectionById(accountSid, payload);
};
exports.getProfileSectionById = getProfileSectionById;
