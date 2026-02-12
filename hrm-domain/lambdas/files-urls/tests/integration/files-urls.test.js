"use strict";
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
const s3_client_1 = require("@tech-matters/s3-client");
const index_1 = require("../../index");
const __mocks__1 = require("../__mocks__");
const bucket = __mocks__1.mockQueryStringParameters.bucket;
const bodyObject = { test: 'test' };
const body = JSON.stringify(bodyObject);
describe('files-urls', () => {
    let key;
    beforeAll(async () => {
        key = `${Math.floor(Math.random() * 1000000)}/test-file.json`;
        await (0, s3_client_1.putS3Object)({
            bucket,
            key,
            body,
        });
    });
    afterAll(async () => {
        await (0, s3_client_1.deleteS3Object)({
            bucket,
            key,
        });
    });
    it('should retrieve valid media url for contactRecording', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                key,
            },
        });
        console.log('event', event);
        const response = await (0, index_1.handler)(event);
        expect(response.statusCode).toBe(200);
        expect(response.body).toBeDefined();
        const respBody = JSON.parse(response.body);
        expect(respBody.media_url).toBeDefined();
        const fetchResponse = await fetch(respBody.media_url);
        expect(fetchResponse.status).toBe(200);
        const fetchBody = await fetchResponse.json();
        expect(fetchBody).toEqual(bodyObject);
    });
    it('should throw a 500 error for missing method', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                method: undefined,
            },
        });
        const response = await (0, index_1.handler)(event);
        expect(response.statusCode).toBe(500);
    });
    it('should throw a 500 error for invalid method', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                method: 'invalid-method',
            },
        });
        const response = await (0, index_1.handler)(event);
        expect(response.statusCode).toBe(500);
    });
    it('should throw a 404 error for signed s3 link for invalid key', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                key: 'invalid-key',
            },
        });
        const response = await (0, index_1.handler)(event);
        expect(response.statusCode).toBe(200);
        expect(response.body).toBeDefined();
        const respBody = JSON.parse(response.body);
        expect(respBody.media_url).toBeDefined();
        const fetchResponse = await fetch(respBody.media_url);
        expect(fetchResponse.status).toBe(404);
    });
});
