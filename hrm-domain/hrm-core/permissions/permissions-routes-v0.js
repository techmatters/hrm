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
const index_1 = require("./index");
const http_errors_1 = __importDefault(require("http-errors"));
const canPerformActionOnObject_1 = require("./canPerformActionOnObject");
const actions_1 = require("./actions");
const types_1 = require("@tech-matters/types");
exports.default = (permissions) => {
    const permissionsRouter = (0, index_1.SafeRouter)();
    permissionsRouter.get('/', index_1.publicEndpoint, async (req, res, next) => {
        try {
            const { accountSid } = req.user;
            if (!permissions.rules) {
                return next((0, http_errors_1.default)(400, 'Reading rules is not supported by the permissions implementation being used by this instance of the HRM service.'));
            }
            const rules = await permissions.rules(accountSid);
            res.json(rules);
        }
        catch (error) {
            return next((0, http_errors_1.default)(500, error.message));
        }
    });
    const parseActionGetPayload = ({ objectType, objectId, }) => {
        if (!objectType || !(0, actions_1.isTargetKind)(objectType)) {
            return (0, types_1.newErr)({
                message: 'invalid objectType',
                error: 'InvalidObjectType',
            });
        }
        return (0, types_1.newOk)({ data: { objectType, objectId } });
    };
    permissionsRouter.get('/:action', index_1.publicEndpoint, async (req, res, next) => {
        const { user, can, hrmAccountId } = req;
        const { bucket, key } = req.query;
        const { action } = req.params;
        try {
            const parseResult = parseActionGetPayload({
                objectType: req.query.objectType,
                objectId: req.query.objectId,
            });
            if ((0, types_1.isErr)(parseResult)) {
                return next((0, types_1.mapHTTPError)(parseResult, { InvalidObjectType: 400, InternalServerError: 500 }));
            }
            const { objectType, objectId } = parseResult.data;
            const canPerformResult = await (0, canPerformActionOnObject_1.canPerformActionsOnObject)({
                hrmAccountId,
                targetKind: objectType,
                actions: [action],
                objectId,
                can,
                user,
            });
            if ((0, types_1.isErr)(canPerformResult)) {
                return next((0, types_1.mapHTTPError)(canPerformResult, {
                    InvalidObjectType: 400,
                    InternalServerError: 500,
                }));
            }
            if (!canPerformResult.data) {
                return next((0, http_errors_1.default)(403, 'Not allowed'));
            }
            if ((0, canPerformActionOnObject_1.isFilesRelatedAction)(objectType, action)) {
                const isValidLocationResult = await (0, canPerformActionOnObject_1.isValidFileLocation)({
                    hrmAccountId,
                    targetKind: objectType,
                    objectId,
                    bucket,
                    key,
                });
                if ((0, types_1.isErr)(isValidLocationResult)) {
                    return next((0, types_1.mapHTTPError)(isValidLocationResult, { InternalServerError: 500 }));
                }
                if (!isValidLocationResult.data) {
                    return next((0, http_errors_1.default)(403, 'Not allowed'));
                }
            }
            // TODO: what do we expect here?
            res.json({ message: 'all good :)' });
        }
        catch (error) {
            return next((0, http_errors_1.default)(500, error instanceof Error ? error.message : JSON.stringify(error)));
        }
    });
    return permissionsRouter.expressRouter;
};
