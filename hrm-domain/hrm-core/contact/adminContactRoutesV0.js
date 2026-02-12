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
const hrm_types_1 = require("@tech-matters/hrm-types");
const permissions_1 = require("../permissions");
const contactsNotifyService_1 = require("./contactsNotifyService");
const http_errors_1 = __importDefault(require("http-errors"));
const adminContactsRouter = (0, permissions_1.SafeRouter)();
// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post('/:notifyOperation', permissions_1.publicEndpoint, async (req, res, next) => {
    const notifyOperation = req.params
        .notifyOperation;
    if (!hrm_types_1.manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
        throw (0, http_errors_1.default)(404);
    }
    console.log(`.......${notifyOperation}ing contacts......`, req, res);
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;
    const resultStream = await (0, contactsNotifyService_1.processContactsStream)(hrmAccountId, dateFrom, dateTo, notifyOperation);
    resultStream.on('error', err => {
        next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
});
exports.default = adminContactsRouter.expressRouter;
