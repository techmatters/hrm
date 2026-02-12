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
exports.getContact = exports.connectToCase = void 0;
const hrm_authentication_1 = require("@tech-matters/hrm-authentication");
const types_1 = require("@tech-matters/types");
const connectToCase = async ({ accountSid, caseId, contactId, baseUrl, staticKey, }) => {
    try {
        // TODO?: set api version via env vars
        const urlPath = `/internal/v0/accounts/${accountSid}/contacts/${contactId}/connectToCase`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'PUT',
            body: { caseId },
        });
        if ((0, types_1.isErr)(result)) {
            return result;
        }
        return result;
    }
    catch (err) {
        return (0, types_1.newErr)({
            error: err,
            message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
        });
    }
};
exports.connectToCase = connectToCase;
const getContact = async ({ accountSid, contactId, baseUrl, staticKey, }) => {
    try {
        // TODO?: set api version via env vars
        const urlPath = `/internal/v0/accounts/${accountSid}/contacts/${contactId}`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'GET',
        });
        if ((0, types_1.isErr)(result)) {
            return result;
        }
        return result;
    }
    catch (err) {
        return (0, types_1.newErr)({
            error: err,
            message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
        });
    }
};
exports.getContact = getContact;
