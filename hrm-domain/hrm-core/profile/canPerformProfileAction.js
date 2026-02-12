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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canPerformActionOnProfileSectionMiddleware = exports.canPerformActionOnProfileSection = exports.canPerformActionOnProfileMiddleware = exports.canPerformActionOnProfile = void 0;
const types_1 = require("@tech-matters/types");
const async_handler_1 = __importDefault(require("../async-handler"));
const profileService_1 = require("./profileService");
const canPerformActionOnProfile = async ({ hrmAccountId, action, can, profileId, user, }) => {
    const result = await (0, profileService_1.getProfile)()(hrmAccountId, profileId);
    const isAllowed = can(user, action, result);
    return (0, types_1.newOk)({ data: { isAllowed } });
};
exports.canPerformActionOnProfile = canPerformActionOnProfile;
const canPerformActionOnProfileMiddleware = (action, parseRequest) => (0, async_handler_1.default)(async (req, _res, next) => {
    const { hrmAccountId, can, profileId, user } = parseRequest(req);
    const result = await (0, exports.canPerformActionOnProfile)({
        action,
        hrmAccountId,
        can,
        profileId,
        user,
    });
    if ((0, types_1.isErr)(result)) {
        return next((0, types_1.mapHTTPError)(result, { ProfileNotFoundError: 404, InternalServerError: 500 }));
    }
    if (result.data.isAllowed) {
        console.debug(`[Permission - PERMITTED] User ${user.workerSid} is permitted to perform ${action} on ${hrmAccountId}/${profileId}`);
        req.permit();
    }
    else {
        console.debug(`[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${action} on ${hrmAccountId}/${profileId} - rules failure`);
        req.block();
    }
    next();
});
exports.canPerformActionOnProfileMiddleware = canPerformActionOnProfileMiddleware;
const canPerformActionOnProfileSection = async ({ hrmAccountId, action, can, profileId, sectionId, user, }) => {
    if (sectionId === null && action === 'createProfileSection') {
        const isAllowed = can(user, action, null);
        return (0, types_1.newOk)({ data: { isAllowed } });
    }
    const result = await (0, profileService_1.getProfileSectionById)(hrmAccountId, { profileId, sectionId });
    if (!result) {
        return (0, types_1.newErr)({
            message: `Tried to retrieve profie section with profileId: ${profileId} and sectionId: ${sectionId}, not found`,
            error: 'ProfileSectionNotFoundError',
        });
    }
    const isAllowed = can(user, action, result);
    return (0, types_1.newOk)({ data: { isAllowed } });
};
exports.canPerformActionOnProfileSection = canPerformActionOnProfileSection;
const canPerformActionOnProfileSectionMiddleware = (action, parseRequest) => (0, async_handler_1.default)(async (req, _res, next) => {
    const { hrmAccountId, can, profileId, sectionId, user } = parseRequest(req);
    const result = await (0, exports.canPerformActionOnProfileSection)({
        hrmAccountId,
        action,
        can,
        profileId,
        sectionId,
        user,
    });
    if ((0, types_1.isErr)(result)) {
        return next((0, types_1.mapHTTPError)(result, {
            ProfileSectionNotFoundError: 404,
        }));
    }
    if (result.data.isAllowed) {
        req.permit();
    }
    else {
        req.block();
    }
    next();
});
exports.canPerformActionOnProfileSectionMiddleware = canPerformActionOnProfileSectionMiddleware;
