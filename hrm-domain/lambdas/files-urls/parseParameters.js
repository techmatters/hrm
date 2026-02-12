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
exports.parseParameters = exports.ERROR_MESSAGES = void 0;
const s3_client_1 = require("@tech-matters/s3-client");
const types_1 = require("@tech-matters/types");
const hrm_authentication_1 = require("@tech-matters/hrm-authentication");
const objectTypes = {
    contact: {
        requiredParameters: ['objectId'],
        fileTypes: ['recording', 'transcript'],
    },
    case: {
        requiredParameters: ['objectId'],
        fileTypes: ['document'],
    },
};
exports.ERROR_MESSAGES = {
    MISSING_QUERY_STRING_PARAMETERS: 'Missing queryStringParameters',
    MISSING_REQUIRED_QUERY_STRING_PARAMETERS: 'Missing required queryStringParameters: method, bucket, key, accountSid, fileType',
    INVALID_METHOD: 'Invalid method',
    INVALID_OBJECT_TYPE: 'Invalid objectType',
    INVALID_FILE_TYPE: 'Invalid fileType',
    MISSING_REQUIRED_PARAMETERS_FOR_FILE_TYPE: 'Missing required parameters for fileType',
};
const isSignedUrlMethod = (method) => Object.keys(s3_client_1.GET_SIGNED_URL_METHODS).includes(method);
const parsePathParameters = (path) => {
    const accountSidAndObjectMatch = /\/accounts\/([^\/]+)/.exec(path);
    return {
        accountSid: accountSidAndObjectMatch ? accountSidAndObjectMatch[1] : undefined,
    };
};
const parseParameters = (event) => {
    const { path, queryStringParameters } = event;
    if (!queryStringParameters) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.MISSING_QUERY_STRING_PARAMETERS,
            error: 'MissingQueryParamsError',
        });
    }
    const method = queryStringParameters.method && decodeURIComponent(queryStringParameters.method);
    const bucket = queryStringParameters.bucket && decodeURIComponent(queryStringParameters.bucket);
    const key = queryStringParameters.key && decodeURIComponent(queryStringParameters.key);
    const objectType = queryStringParameters.objectType &&
        decodeURIComponent(queryStringParameters.objectType);
    const objectId = queryStringParameters.objectId && decodeURIComponent(queryStringParameters.objectId);
    const fileType = queryStringParameters.fileType && decodeURIComponent(queryStringParameters.fileType);
    const { accountSid } = parsePathParameters(path);
    if (!method || !bucket || !key || !accountSid || !objectType || !fileType) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.MISSING_REQUIRED_QUERY_STRING_PARAMETERS,
            error: 'MissingRequiredQueryParamsError',
        });
    }
    if (!isSignedUrlMethod(method)) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.INVALID_METHOD,
            error: 'MethodNotAllowedError',
        });
    }
    const objectTypeConfig = objectTypes[objectType];
    if (!objectTypeConfig || !(0, hrm_authentication_1.isAuthenticationObjectType)(objectType)) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.INVALID_OBJECT_TYPE,
            error: 'InvalidObjectTypeError',
        });
    }
    if (!objectTypeConfig.fileTypes.includes(fileType)) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.INVALID_FILE_TYPE,
            error: 'InvalidFileTypeError',
        });
    }
    const missingRequiredParameters = objectTypeConfig.requiredParameters.filter(requiredParameter => !queryStringParameters[requiredParameter]);
    if (missingRequiredParameters.length > 0) {
        return (0, types_1.newErr)({
            message: exports.ERROR_MESSAGES.MISSING_REQUIRED_PARAMETERS_FOR_FILE_TYPE,
            error: 'MissingRequiredFileParamsError',
        });
    }
    return (0, types_1.newOk)({
        data: {
            method,
            bucket,
            key,
            objectType,
            objectId,
            fileType: fileType,
            accountSid,
        },
    });
};
exports.parseParameters = parseParameters;
