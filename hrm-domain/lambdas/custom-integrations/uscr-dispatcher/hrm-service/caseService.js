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
exports.getCaseSections = exports.updateCaseSection = exports.createCaseSection = exports.deleteCase = exports.getCase = exports.createCase = void 0;
const hrm_authentication_1 = require("@tech-matters/hrm-authentication");
const types_1 = require("@tech-matters/types");
const createCase = async ({ accountSid, casePayload, baseUrl, staticKey, }) => {
    try {
        // TODO?: set api version via env vars
        const urlPath = `/internal/v0/accounts/${accountSid}/cases`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'POST',
            body: casePayload,
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
exports.createCase = createCase;
const getCase = async ({ accountSid, caseId, baseUrl, staticKey, }) => {
    try {
        const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}`;
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
exports.getCase = getCase;
const deleteCase = async ({ accountSid, caseId, baseUrl, staticKey, }) => {
    try {
        const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'DELETE',
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
exports.deleteCase = deleteCase;
const createCaseSection = async ({ accountSid, caseId, sectionType, sectionTypeSpecificData, baseUrl, staticKey, }) => {
    try {
        const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'POST',
            body: { sectionTypeSpecificData },
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
exports.createCaseSection = createCaseSection;
const updateCaseSection = async ({ accountSid, caseId, sectionId, sectionType, sectionTypeSpecificData, baseUrl, staticKey, }) => {
    try {
        const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}/${sectionId}`;
        const authHeader = `Basic ${staticKey}`;
        const result = await (0, hrm_authentication_1.callHrmApi)(baseUrl)({
            urlPath,
            authHeader,
            method: 'PUT',
            body: { sectionTypeSpecificData },
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
exports.updateCaseSection = updateCaseSection;
const getCaseSections = async ({ accountSid, caseId, sectionType, baseUrl, staticKey, }) => {
    try {
        const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/timeline?sectionTypes=${sectionType}&includeContacts=false`;
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
exports.getCaseSections = getCaseSections;
