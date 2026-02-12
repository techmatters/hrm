"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const jest_mock_1 = require("jest-mock");
const types_1 = require("@tech-matters/types");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const getSignedS3Url_1 = __importDefault(require("../../getSignedS3Url"));
const __mocks__1 = require("../__mocks__");
jest.mock('@tech-matters/hrm-authentication', () => ({
    ...jest.requireActual('@tech-matters/hrm-authentication'),
    authenticate: () => Promise.resolve((0, types_1.newOk)({ data: 'ok :)' })),
}));
jest.mock('@aws-sdk/s3-request-presigner');
const mockedGetSignedUrl = (0, jest_mock_1.mocked)(s3_request_presigner_1.getSignedUrl);
describe('getSignedS3Url', () => {
    beforeEach(() => {
        mockedGetSignedUrl.mockClear();
    });
    it('should return media url for getObject method', async () => {
        mockedGetSignedUrl.mockResolvedValue(__mocks__1.mockSignedUrl);
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: __mocks__1.mockQueryStringParameters,
        });
        const result = await (0, getSignedS3Url_1.default)(event);
        expect(result.unwrap()).toEqual({ media_url: __mocks__1.mockSignedUrl });
    });
});
