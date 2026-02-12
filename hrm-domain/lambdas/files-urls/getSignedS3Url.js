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
exports.convertBasicAuthHeader = void 0;
const types_1 = require("@tech-matters/types");
const hrm_authentication_1 = require("@tech-matters/hrm-authentication");
const s3_client_1 = require("@tech-matters/s3-client");
const parseParameters_1 = require("./parseParameters");
/**
 * Twilio insights sends a basic auth header with the username as the string token and the password as the flexJWE.
 * This function converts that to a bearer token for use with the hrm-authentication package.
 *
 * example from https://www.twilio.com/docs/flex/developer/insights/playback-recordings-custom-storage#validate-the-flex-jwe-token:
 * Basic ${Buffer.from(`token:${flexJWE}`).toString('base64')}
 **/
const convertBasicAuthHeader = (authHeader) => {
    if (!authHeader)
        return authHeader;
    const [type, token] = authHeader.split(' ');
    if (type == 'Bearer')
        return authHeader;
    const [username, password] = Buffer.from(token, 'base64').toString().split(':');
    if (username == 'token')
        return `Bearer ${password}`;
    return authHeader;
};
exports.convertBasicAuthHeader = convertBasicAuthHeader;
const getSignedS3Url = async (event) => {
    const parseParametersResult = (0, parseParameters_1.parseParameters)(event);
    if ((0, types_1.isErr)(parseParametersResult)) {
        return parseParametersResult;
    }
    const { accountSid, bucket, key, method, objectType, objectId, fileType } = parseParametersResult.data;
    const authorization = event.headers?.Authorization || event.headers?.authorization;
    const authenticateResult = await (0, hrm_authentication_1.authenticate)({
        accountSid,
        objectType,
        objectId,
        authHeader: (0, exports.convertBasicAuthHeader)(authorization),
        type: 'filesUrls',
        requestData: {
            fileType,
            method,
            bucket,
            key,
        },
    });
    if ((0, types_1.isErr)(authenticateResult)) {
        return authenticateResult;
    }
    try {
        const getSignedUrlResult = await (0, s3_client_1.getSignedUrl)({
            method,
            bucket,
            key,
        });
        return (0, types_1.newOk)({
            data: {
                media_url: getSignedUrlResult,
            },
        });
    }
    catch (error) {
        return (0, types_1.newErr)({
            message: error,
            error: 'InternalServerError',
        });
    }
};
exports.default = getSignedS3Url;
