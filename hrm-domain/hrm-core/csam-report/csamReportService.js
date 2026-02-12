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
exports.acknowledgeCsamReport = exports.getCsamReportsByContactId = exports.createCSAMReport = exports.getCSAMReport = void 0;
const crypto_1 = require("crypto");
const csamReportDataAccess_1 = require("./csamReportDataAccess");
const csamReportRecordToCsamReport = ({ contactId, ...record }) => ({
    ...record,
    ...(contactId ? { contactId: contactId.toString() } : {}),
});
// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
const getCSAMReport = async (reportId, accountSid) => {
    const record = await (0, csamReportDataAccess_1.getById)(parseInt(reportId), accountSid);
    return csamReportRecordToCsamReport(record);
};
exports.getCSAMReport = getCSAMReport;
const createCSAMReport = async (body, accountSid) => {
    const { reportType, twilioWorkerId, contactId: inputContactId } = body;
    const acknowledged = reportType !== 'self-generated';
    const csamReportId = acknowledged ? body.csamReportId : (0, crypto_1.randomUUID)();
    // TODO: Should we check if the randomUUID exists in DB here?
    const record = await (0, csamReportDataAccess_1.create)({
        contactId: inputContactId || null,
        reportType,
        csamReportId,
        twilioWorkerId: twilioWorkerId || null,
        acknowledged,
    }, accountSid);
    return csamReportRecordToCsamReport(record);
};
exports.createCSAMReport = createCSAMReport;
// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
const getCsamReportsByContactId = async (contactId, accountSid) => {
    const records = await (0, csamReportDataAccess_1.getByContactId)(parseInt(contactId), accountSid);
    return records.map(csamReportRecordToCsamReport);
};
exports.getCsamReportsByContactId = getCsamReportsByContactId;
exports.acknowledgeCsamReport = (0, csamReportDataAccess_1.updateAcknowledgedByCsamReportId)(true);
