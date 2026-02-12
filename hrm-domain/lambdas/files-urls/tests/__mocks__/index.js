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
exports.mockSignedUrl = exports.newAlbEvent = exports.albEventBase = exports.mockQueryStringParameters = exports.mockPath = exports.mockPathParameters = void 0;
exports.mockPathParameters = {
    accountSid: 'mockAccountSid',
};
const mockPath = ({ accountSid = 'mockAccountSid' }) => `/v0/accounts/${accountSid}/files/url`;
exports.mockPath = mockPath;
exports.mockQueryStringParameters = {
    method: 'getObject',
    bucket: 'docs-bucket',
    key: 'test-key',
    objectType: 'contact',
    objectId: 'test-object-id',
    fileType: 'recording',
};
exports.albEventBase = {
    httpMethod: 'GET',
    requestContext: {
        elb: {
            targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/lambda-123456789012/1234567890123456',
        },
    },
    body: '',
    isBase64Encoded: false,
    path: (0, exports.mockPath)({}),
    queryStringParameters: exports.mockQueryStringParameters,
};
const newAlbEvent = (partial) => {
    return { ...exports.albEventBase, ...partial };
};
exports.newAlbEvent = newAlbEvent;
exports.mockSignedUrl = 'https://example.com/signed-url';
