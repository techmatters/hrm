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
exports.canEditCaseOverview = exports.canUpdateCaseStatus = exports.canViewCase = exports.canPerformCaseAction = void 0;
const async_handler_1 = __importDefault(require("../async-handler"));
const caseService_1 = require("./caseService");
const http_errors_1 = __importDefault(require("http-errors"));
const permissions_1 = require("../permissions");
/**
 * Generic function to check if the user can perform an action on a case.
 * @param generateActions - Function to generate the actions to be checked based on the case as it currently exists in the DB and the request.
 * @param getCaseIdFromRequest - Function to get the case ID from the request if it is not tokenised as :id in the route.
 * @param notFoundIfNotPermitted - If true, it will throw a 404 error if the user is not permitted to perform the action, use for read requests to prevent information leakage.
 */
const canPerformCaseAction = (generateActions, getCaseIdFromRequest = req => req.params.id, notFoundIfNotPermitted = false) => (0, async_handler_1.default)(async (req, res, next) => {
    if (!req.isPermitted()) {
        const { hrmAccountId, user, can } = req;
        const id = getCaseIdFromRequest(req);
        const caseObj = await (0, caseService_1.getCase)(id, hrmAccountId, {
            user,
        });
        if (!caseObj)
            throw (0, http_errors_1.default)(404);
        const actions = generateActions(caseObj, req);
        console.debug(`Actions attempted in case edit (case #${id})`, actions);
        const canEdit = actions.every(action => can(user, action, caseObj));
        if (canEdit) {
            console.debug(`[Permission - PERMITTED] User ${user.workerSid} is permitted to perform ${actions} on case ${hrmAccountId}/${id}`);
            req.permit();
        }
        else {
            console.debug(`[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${actions} on case ${hrmAccountId}/${id} - rules failure`);
            if (notFoundIfNotPermitted)
                throw (0, http_errors_1.default)(404);
            req.block();
        }
    }
    next();
});
exports.canPerformCaseAction = canPerformCaseAction;
/**
 * It checks if the user can view the case according to the defined permission rules.
 */
exports.canViewCase = (0, exports.canPerformCaseAction)(() => [permissions_1.actionsMaps.case.VIEW_CASE], req => req.params.id, true);
exports.canUpdateCaseStatus = (0, exports.canPerformCaseAction)(({ status: savedStatus }, { body: { status: updatedStatus } }) => {
    if (updatedStatus === savedStatus)
        return [];
    if (updatedStatus === 'closed')
        return [permissions_1.actionsMaps.case.CLOSE_CASE];
    return savedStatus === 'closed'
        ? [permissions_1.actionsMaps.case.REOPEN_CASE]
        : [permissions_1.actionsMaps.case.CASE_STATUS_TRANSITION];
});
exports.canEditCaseOverview = (0, exports.canPerformCaseAction)(() => [
    permissions_1.actionsMaps.case.EDIT_CASE_OVERVIEW,
]);
