"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@tech-matters/types");
const parseParameters_1 = require("../../parseParameters");
const __mocks__1 = require("../__mocks__");
describe('parseParameters', () => {
    it('should return a 500 error for missing query string options', async () => {
        const event = {
            queryStringParameters: {},
        };
        const result = await (0, parseParameters_1.parseParameters)(event);
        expect((0, types_1.isErr)(result)).toBeTruthy();
        expect(result.message).toEqual(parseParameters_1.ERROR_MESSAGES.MISSING_REQUIRED_QUERY_STRING_PARAMETERS);
    });
    it('should return a 500 error for invalid method', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                method: 'invalidMethod',
            },
        });
        const result = await (0, parseParameters_1.parseParameters)(event);
        expect((0, types_1.isErr)(result)).toBeTruthy();
        expect(result.message).toEqual(parseParameters_1.ERROR_MESSAGES.INVALID_METHOD);
    });
    it('should return a 500 error for invalid fileType', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                fileType: 'invalidFileType',
            },
        });
        const result = await (0, parseParameters_1.parseParameters)(event);
        expect((0, types_1.isErr)(result)).toBeTruthy();
        expect(result.message).toEqual(parseParameters_1.ERROR_MESSAGES.INVALID_FILE_TYPE);
    });
    it('should return a 500 error for missing required parameters for fileType', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: {
                ...__mocks__1.mockQueryStringParameters,
                objectType: 'contact',
                objectId: undefined,
                fileType: 'recording',
            },
        });
        const result = await (0, parseParameters_1.parseParameters)(event);
        expect((0, types_1.isErr)(result)).toBeTruthy();
        expect(result.message).toEqual(parseParameters_1.ERROR_MESSAGES.MISSING_REQUIRED_PARAMETERS_FOR_FILE_TYPE);
    });
    it('should return a 200 success for valid parameters', async () => {
        const event = (0, __mocks__1.newAlbEvent)({
            queryStringParameters: __mocks__1.mockQueryStringParameters,
        });
        const result = await (0, parseParameters_1.parseParameters)(event);
        expect((0, types_1.isErr)(result)).toBeFalsy();
        expect(result.unwrap()).toEqual({
            ...__mocks__1.mockQueryStringParameters,
            ...__mocks__1.mockPathParameters,
        });
    });
});
