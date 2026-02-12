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
const http_errors_1 = __importDefault(require("http-errors"));
const permissions_1 = require("../permissions");
const csamReportService_1 = require("./csamReportService");
const csamReportRouter = (0, permissions_1.SafeRouter)();
csamReportRouter.post('/', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const { contactId, csamReportId, twilioWorkerId, reportType } = req.body;
    // Validate that the payload has a proper format
    if (reportType &&
        reportType !== 'counsellor-generated' &&
        reportType !== 'self-generated') {
        throw (0, http_errors_1.default)(422, 'Invalid argument "reportType" provided');
    }
    if ((!reportType || reportType === 'counsellor-generated') && !csamReportId) {
        throw (0, http_errors_1.default)(422, 'Invalid, "reportType" argument specifies "counsellor-generated" report, but no csamReportId argument provided');
    }
    const createdCSAMReport = await (0, csamReportService_1.createCSAMReport)({ contactId, csamReportId, twilioWorkerId, reportType }, hrmAccountId);
    res.json(createdCSAMReport);
});
csamReportRouter.post('/:reportId(\\d+)/acknowledge', permissions_1.publicEndpoint, async (req, res) => {
    const { hrmAccountId } = req;
    const reportId = parseInt(req.params.reportId, 10);
    const acknowledgedReport = await (0, csamReportService_1.acknowledgeCsamReport)(reportId, hrmAccountId);
    if (!acknowledgedReport) {
        throw (0, http_errors_1.default)(404, `Report with id ${reportId} not found`);
    }
    res.json(acknowledgedReport);
});
exports.default = csamReportRouter.expressRouter;
