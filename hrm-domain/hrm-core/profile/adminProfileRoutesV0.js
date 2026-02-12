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
const hrm_types_1 = require("@tech-matters/hrm-types");
const types_1 = require("@tech-matters/types");
const permissions_1 = require("../permissions");
const profileController = __importStar(require("./profileService"));
const http_errors_1 = __importDefault(require("http-errors"));
const profileNotifyService_1 = require("./profileNotifyService");
const adminProfilesRouter = (0, permissions_1.SafeRouter)();
adminProfilesRouter.post('/identifiers', permissions_1.publicEndpoint, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { identifier, name, definitionVersion } = req.body;
    const result = await profileController.createProfileWithIdentifierOrError(hrmAccountId, { identifier: { identifier }, profile: { name, definitionVersion } }, { user });
    if ((0, types_1.isErr)(result)) {
        return next((0, types_1.mapHTTPError)(result, {
            InvalidParameterError: 400,
            IdentifierExistsError: 409,
        }));
    }
    res.json(result.data);
});
adminProfilesRouter.get('/flags', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const result = await profileController.getProfileFlags(hrmAccountId);
    res.json(result);
});
adminProfilesRouter.post('/flags', permissions_1.publicEndpoint, async (req, res, next) => {
    try {
        const { hrmAccountId, user } = req;
        const { name } = req.body;
        const result = await profileController.createProfileFlag(hrmAccountId, { name }, { user });
        if ((0, types_1.isErr)(result)) {
            return next((0, types_1.mapHTTPError)(result, { InvalidParameterError: 400 }));
        }
        res.json(result);
    }
    catch (err) {
        console.error(err);
        return next((0, http_errors_1.default)(500, err.message));
    }
});
adminProfilesRouter.patch('/flags/:flagId', permissions_1.publicEndpoint, async (req, res, next) => {
    const { hrmAccountId, user } = req;
    const { flagId } = req.params;
    const { name } = req.body;
    const result = await profileController.updateProfileFlagById(hrmAccountId, parseInt(flagId, 10), {
        name,
    }, { user });
    if ((0, types_1.isOk)(result)) {
        if (!result.data) {
            return next((0, http_errors_1.default)(404));
        }
        res.json({
            result: `Succesfully deleted flag ${result.data.name} (ID ${result.data.id})`,
        });
    }
    else {
        throw (0, http_errors_1.default)(400);
    }
});
adminProfilesRouter.delete('/flags/:flagId', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const { flagId } = req.params;
    const result = await profileController.deleteProfileFlagById(parseInt(flagId, 10), hrmAccountId);
    res.json(result);
});
// admin POST endpoint to renotify cases. req body has accountSid, dateFrom, dateTo
adminProfilesRouter.post('/:notifyOperation', permissions_1.publicEndpoint, async (req, res, next) => {
    const notifyOperation = req.params
        .notifyOperation;
    if (!hrm_types_1.manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
        throw (0, http_errors_1.default)(404);
    }
    console.log(`.......${notifyOperation}ing profiles......`, req, res);
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;
    const resultStream = await (0, profileNotifyService_1.renotifyProfilesStream)(hrmAccountId, dateFrom, dateTo, notifyOperation);
    resultStream.on('error', err => {
        next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
});
exports.default = adminProfilesRouter.expressRouter;
