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
exports.validateHeaders = exports.validatePayload = exports.validateEnvironment = void 0;
const types_1 = require("@tech-matters/types");
const validateEnvironment = () => {
    const environment = process.env.NODE_ENV;
    if (!environment) {
        return (0, types_1.newErr)({
            error: 'Environment validation failed',
            message: 'NODE_ENV variable missing',
        });
    }
    const hrmInternalUrl = process.env.INTERNAL_HRM_URL;
    if (!hrmInternalUrl) {
        return (0, types_1.newErr)({
            error: 'Environment validation failed',
            message: 'HRM_BASE_URL variable missing',
        });
    }
    return (0, types_1.newOk)({ data: { environment, baseUrl: hrmInternalUrl } });
};
exports.validateEnvironment = validateEnvironment;
const validatePayload = ({ accountSid, casePayload, contactId, }) => {
    if (!accountSid) {
        return (0, types_1.newErr)({
            error: 'Payload validation failed',
            message: 'accountSid parameter missing',
        });
    }
    if (!casePayload) {
        return (0, types_1.newErr)({
            error: 'Payload validation failed',
            message: 'casePayload parameter missing',
        });
    }
    if (!contactId) {
        return (0, types_1.newErr)({
            error: 'Payload validation failed',
            message: 'contactId parameter missing',
        });
    }
    return (0, types_1.newOk)({ data: { accountSid, casePayload, contactId } });
};
exports.validatePayload = validatePayload;
const validateHeaders = (headers) => {
    if (!headers) {
        return (0, types_1.newErr)({
            error: 'Headers validation failed',
            message: 'no headers provided',
        });
    }
    if (!headers.authorization) {
        return (0, types_1.newErr)({
            error: 'Headers validation failed',
            message: 'no authorization header provided',
        });
    }
    return (0, types_1.newOk)({ data: { authToken: headers.authorization } });
};
exports.validateHeaders = validateHeaders;
