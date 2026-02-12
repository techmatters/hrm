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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@tech-matters/types");
const http_errors_1 = __importDefault(require("http-errors"));
const date_fns_1 = require("date-fns");
const permissions_1 = require("../permissions");
const profileController = __importStar(require("./profileService"));
const contactService_1 = require("../contact/contactService");
const caseService_1 = require("../case/caseService");
const canPerformProfileAction_1 = require("./canPerformProfileAction");
const profilesRouter = (0, permissions_1.SafeRouter)();
/**
 * Returns a filterable list of cases for a helpline
 *
 * @param {string} req.accountSid - SID of the helpline
 * @param {profileController.ProfileListConfiguration['sortDirection']} req.query.sortDirection - Sort direction
 * @param {profileController.ProfileListConfiguration['sortBy']} req.query.sortBy - Sort by
 * @param {profileController.ProfileListConfiguration['limit']} req.query.limit - Limit
 * @param {profileController.ProfileListConfiguration['offset']} req.query.offset - Offset
 * @param {profileController.SearchParameters['filters']['profileFlagIds']} req.query.profileFlagIds
 */
profilesRouter.get('/', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const { sortDirection, sortBy, limit, offset, profileFlagIds: encodedProfileFlagIds, } = req.query; // TODO: maybe improve this validation
    const profileFlagIds = encodedProfileFlagIds
        ? decodeURIComponent(encodedProfileFlagIds)
            .split(',')
            .map(s => parseInt(s, 10))
            .filter(v => v && !isNaN(v))
        : undefined;
    const filters = {
        profileFlagIds,
    };
    const result = await profileController.listProfiles(hrmAccountId, { sortDirection, sortBy, limit, offset }, { filters });
    res.json(result);
});
profilesRouter.get('/identifier/:identifier', permissions_1.publicEndpoint, async (req, res, next) => {
    const { hrmAccountId } = req;
    const { identifier } = req.params;
    const result = await profileController.getIdentifierByIdentifier(hrmAccountId, identifier);
    if (!result) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result);
});
profilesRouter.get('/identifier/:identifier/flags', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const { identifier } = req.params;
    const result = await profileController.getProfileFlagsByIdentifier(hrmAccountId, identifier);
    if (!result) {
        throw (0, http_errors_1.default)(404);
    }
    res.json(result);
});
profilesRouter.get('/:profileId/contacts', permissions_1.publicEndpoint, async (req, res, next) => {
    try {
        const { hrmAccountId, user } = req;
        const { profileId } = req.params;
        const result = await (0, contactService_1.getContactsByProfileId)(hrmAccountId, parseInt(profileId, 10), req.query, {
            can: req.can,
            user: req.user,
            permissionRules: req.permissionRules,
        });
        console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: contacts for profile read, profile id: ${profileId}`);
        if ((0, types_1.isErr)(result)) {
            return next((0, types_1.mapHTTPError)(result, { InternalServerError: 500 }));
        }
        res.json(result.data);
    }
    catch (err) {
        return next((0, http_errors_1.default)(500, err.message));
    }
});
profilesRouter.get('/:profileId/cases', permissions_1.publicEndpoint, async (req, res, next) => {
    try {
        const { hrmAccountId, can, user, permissionRules } = req;
        const { profileId } = req.params;
        const result = await (0, caseService_1.getCasesByProfileId)(hrmAccountId, parseInt(profileId, 10), req.query, { can, user, permissionRules });
        console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: cases for profile read, profile id: ${profileId}`);
        if ((0, types_1.isErr)(result)) {
            return next((0, types_1.mapHTTPError)(result, { InternalServerError: 500 }));
        }
        res.json(result.data);
    }
    catch (err) {
        return next((0, http_errors_1.default)(500, err.message));
    }
});
profilesRouter.get('/flags', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const result = await profileController.getProfileFlags(hrmAccountId);
    res.json(result);
});
const canAssociate = (0, canPerformProfileAction_1.canPerformActionOnProfileMiddleware)(permissions_1.actionsMaps.profile.FLAG_PROFILE, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
}));
profilesRouter.post('/:profileId/flags/:profileFlagId', canAssociate, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { profileId, profileFlagId } = req.params;
    const { validUntil } = req.body;
    if (validUntil && !Date.parse(validUntil)) {
        return next((0, http_errors_1.default)(400));
    }
    const parsedValidUntil = validUntil ? (0, date_fns_1.parseISO)(validUntil) : null;
    if (validUntil && !(0, date_fns_1.isValid)(parsedValidUntil)) {
        return next((0, http_errors_1.default)(400));
    }
    const result = await profileController.associateProfileToProfileFlag(hrmAccountId, {
        profileId: parseInt(profileId),
        profileFlagId: parseInt(profileFlagId),
        validUntil: parsedValidUntil,
    }, { user });
    if ((0, types_1.isErr)(result)) {
        return next((0, types_1.mapHTTPError)(result, {
            InvalidParameterError: 400,
            ProfileAlreadyFlaggedError: 409,
        }));
    }
    if (!result.data) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result.data);
});
const canDisassociate = (0, canPerformProfileAction_1.canPerformActionOnProfileMiddleware)(permissions_1.actionsMaps.profile.UNFLAG_PROFILE, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
}));
profilesRouter.delete('/:profileId/flags/:profileFlagId', canDisassociate, async (req, res, next) => {
    const { hrmAccountId, user, params } = req;
    const { profileId, profileFlagId } = params;
    const result = await profileController.disassociateProfileFromProfileFlag(hrmAccountId, {
        profileId: parseInt(profileId, 10),
        profileFlagId: parseInt(profileFlagId, 10),
    }, { user });
    if (!result) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result);
});
// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//     "sectionType": "note"
//   }'
const canCreateProfileSection = (0, canPerformProfileAction_1.canPerformActionOnProfileSectionMiddleware)(permissions_1.actionsMaps.profileSection.CREATE_PROFILE_SECTION, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: null,
    user: req.user,
}));
profilesRouter.post('/:profileId/sections', canCreateProfileSection, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { profileId } = req.params;
    const { content, sectionType } = req.body;
    const result = await profileController.createProfileSection(hrmAccountId, { content, profileId: parseInt(profileId, 10), sectionType }, { user });
    if (!result) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result);
});
// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections/5' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//   }'
const canEditProfileSection = (0, canPerformProfileAction_1.canPerformActionOnProfileSectionMiddleware)(permissions_1.actionsMaps.profileSection.EDIT_PROFILE_SECTION, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
}));
profilesRouter.patch('/:profileId/sections/:sectionId', canEditProfileSection, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { profileId, sectionId } = req.params;
    const { content } = req.body;
    const result = await profileController.updateProfileSectionById(hrmAccountId, {
        profileId: parseInt(profileId, 10),
        sectionId: parseInt(sectionId, 10),
        content,
    }, { user });
    if (!result) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result);
});
const canViewProfileSection = (0, canPerformProfileAction_1.canPerformActionOnProfileSectionMiddleware)(permissions_1.actionsMaps.profileSection.VIEW_PROFILE_SECTION, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
}));
profilesRouter.get('/:profileId/sections/:sectionId', canViewProfileSection, async (req, res) => {
    const { hrmAccountId, user } = req;
    const { profileId, sectionId } = req.params;
    const result = await profileController.getProfileSectionById(hrmAccountId, {
        profileId: parseInt(profileId, 10),
        sectionId: parseInt(sectionId, 10),
    });
    console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Profile section read, profile id: ${profileId}, section id: ${sectionId}`);
    if (!result) {
        throw (0, http_errors_1.default)(404);
    }
    res.json(result);
});
const canViewProfile = (0, canPerformProfileAction_1.canPerformActionOnProfileMiddleware)(permissions_1.actionsMaps.profile.VIEW_PROFILE, req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
}));
// WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
profilesRouter.get('/:profileId', canViewProfile, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { profileId } = req.params;
    const result = await profileController.getProfile()(hrmAccountId, parseInt(profileId, 10));
    console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid} Action: profile read, profile id: ${profileId}`);
    if (!result) {
        return next((0, http_errors_1.default)(404));
    }
    res.json(result);
});
exports.default = profilesRouter.expressRouter;
