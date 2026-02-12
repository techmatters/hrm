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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("../server");
const mocks_1 = require("../mocks");
const caseService_1 = require("@tech-matters/hrm-core/case/caseService");
const jest_each_1 = __importDefault(require("jest-each"));
const caseSectionService_1 = require("@tech-matters/hrm-core/case/caseSection/caseSectionService");
const setupServiceTest_1 = require("../setupServiceTest");
const { request: publicRequest, internalRequest } = (0, setupServiceTest_1.setupServiceTests)(mocks_1.workerSid);
let targetCase;
beforeEach(async () => {
    targetCase = await (0, caseService_1.createCase)({ definitionVersion: 'as-v1' }, mocks_1.accountSid, mocks_1.workerSid, undefined, true);
});
const getRoutePath = (caseId, sectionType, sectionId) => `/v0/accounts/${mocks_1.accountSid}/cases/${caseId}/sections/${sectionType}${sectionId ? `/${sectionId}` : ''}`;
const publicApiTestSuiteParameters = {
    request: publicRequest,
    requestDescription: 'PUBLIC',
    route: '',
    testHeaders: server_1.headers,
};
const internalApiTestSuiteParameters = {
    request: internalRequest,
    requestDescription: 'INTERNAL',
    route: `/internal`,
    testHeaders: server_1.basicHeaders,
};
(0, jest_each_1.default)([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe('[$requestDescription] POST /cases/:caseId/sections', ({ request, testHeaders, route: baseRoute, requestDescription, }) => {
    test('should return 401 if valid auth headers are not set', async () => {
        const response = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
            .send({ sectionTypeSpecificData: { note: 'hello' } });
        expect(response.status).toBe(401);
    });
    test("should return 404 if case doesn't exist", async () => {
        const response = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id + 1, 'note')}`)
            .set(testHeaders)
            .send({ sectionTypeSpecificData: { note: 'hello' } });
        expect(response.status).toBe(404);
    });
    const testCases = [
        {
            description: 'no sectionId specified should create a new section & assign a section id',
            newSection: { sectionTypeSpecificData: { note: 'hello' } },
        },
        {
            description: 'sectionId specified should create a new section & use that section id',
            newSection: {
                sectionTypeSpecificData: { note: 'hello' },
                sectionId: 'a-specific-id',
            },
        },
        {
            description: 'eventTimestamp specified: should use this in preference to created time',
            newSection: {
                sectionTypeSpecificData: { note: 'hello' },
                eventTimestamp: new Date(2000, 0, 1).toISOString(),
            },
        },
        {
            description: 'any created info should be ignored and the user credentials & current time should be used instead',
            newSection: {
                sectionTypeSpecificData: { note: 'hello' },
                createdBy: 'fake news',
                createdAt: '1979-04-21',
            },
        },
        {
            description: 'any update info should be ignored and the updated fields should be left null instead',
            newSection: {
                sectionTypeSpecificData: { note: 'hello' },
                updatedBy: 'fake news',
                updatedAt: '2079-04-21',
            },
        },
    ];
    (0, jest_each_1.default)(testCases).test('$description', async ({ newSection }) => {
        const startTime = Date.now();
        const response = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
            .set(testHeaders)
            .send(newSection);
        expect(response.status).toBe(200);
        const apiSection = response.body;
        expect(apiSection).toEqual({
            sectionId: expect.any(String),
            sectionType: 'note',
            ...newSection, // Will overwrite sectionId expectation if specified
            createdBy: requestDescription === 'PUBLIC' ? mocks_1.workerSid : `account-${mocks_1.accountSid}`,
            createdAt: expect.toParseAsDate(),
            eventTimestamp: expect.toParseAsDate(newSection.eventTimestamp),
            updatedAt: null,
            updatedBy: null,
        });
        const updatedCase = await (0, caseService_1.getCase)(targetCase.id, mocks_1.accountSid, mocks_1.ALWAYS_CAN);
        // Test that parent case updatedAt is bumped
        expect(new Date(updatedCase.updatedAt).getTime()).toBeGreaterThan(startTime);
        const { sectionId, ...expectedSection } = apiSection;
        const updatedSection = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', apiSection.sectionId);
        expect(updatedSection).toEqual({
            ...expectedSection,
            createdAt: expect.toParseAsDate(apiSection.createdAt),
            eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
        });
    });
    test('Multiple calls add 1 section each', async () => {
        const startTime = Date.now();
        const apiSections = await Promise.all([1, 2, 3].map(async (idx) => {
            const newSection = {
                sectionTypeSpecificData: { note: `hello ${idx}` },
            };
            const response = await request
                .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
                .set(testHeaders)
                .send(newSection);
            expect(response.status).toBe(200);
            return response.body;
        }));
        const updatedCase = await (0, caseService_1.getCase)(targetCase.id, mocks_1.accountSid, mocks_1.ALWAYS_CAN);
        // Test that parent case updatedAt is bumped
        expect(new Date(updatedCase.updatedAt).getTime()).toBeGreaterThan(startTime);
        await Promise.all(apiSections.map(async (apiSection) => {
            const updatedSection = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', apiSection.sectionId);
            const { sectionId, ...expectedSection } = apiSection;
            expect(updatedSection).toEqual({
                ...expectedSection,
                createdAt: expect.toParseAsDate(apiSection.createdAt),
                updatedAt: expect.toParseAsDate(apiSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
            });
        }));
    });
    test('Multiple calls with same specific section ID - will return a 409 after the first', async () => {
        const startTime = Date.now();
        const newSection = {
            sectionId: 'specific-id',
            sectionTypeSpecificData: { note: `hello` },
        };
        const firstResponse = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
            .set(testHeaders)
            .send(newSection);
        expect(firstResponse.status).toBe(200);
        const addedSection = firstResponse.body;
        const secondResponse = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
            .set(testHeaders)
            .send(newSection);
        expect(secondResponse.status).toBe(409);
        const updatedCase = await (0, caseService_1.getCase)(targetCase.id, mocks_1.accountSid, mocks_1.ALWAYS_CAN);
        expect(new Date(updatedCase.updatedAt).getTime()).toBeGreaterThan(startTime);
        const { sectionId, ...expectedSection } = addedSection;
        const updatedSection = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', 'specific-id');
        expect(updatedSection).toEqual({
            ...expectedSection,
            createdAt: expect.toParseAsDate(addedSection.createdAt),
            eventTimestamp: expect.toParseAsDate(addedSection.eventTimestamp),
        });
    });
});
describe('/cases/:caseId/sections/:sectionId', () => {
    let targetSection;
    beforeEach(async () => {
        targetSection = (await (0, caseSectionService_1.createCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', { sectionTypeSpecificData: { note: 'hello' } }, mocks_1.workerSid)).unwrap();
    });
    describe('GET', () => {
        const request = publicRequest;
        test('should return 401 if valid auth headers are not set', async () => {
            const response = await request.get(getRoutePath(targetCase.id, 'note', targetSection.sectionId));
            expect(response.status).toBe(401);
        });
        test("should return 404 if case doesn't exist", async () => {
            const response = await request
                .get(getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId))
                .set(server_1.headers);
            expect(response.status).toBe(404);
        });
        test("should return 404 if case section doesn't exist", async () => {
            const response = await request
                .get(getRoutePath(targetCase.id, 'note', 'nothing-here'))
                .set(server_1.headers);
            expect(response.status).toBe(404);
        });
        test('should return a 200 & the section for a case section that exists', async () => {
            const response = await request
                .get(getRoutePath(targetCase.id, 'note', targetSection.sectionId))
                .set(server_1.headers);
            expect(response.status).toBe(200);
            const apiSection = response.body;
            const { sectionId, ...expectedSection } = targetSection;
            expect(apiSection).toEqual({
                ...expectedSection,
                createdBy: mocks_1.workerSid,
                createdAt: expect.toParseAsDate(),
                eventTimestamp: expect.toParseAsDate(),
                updatedAt: null,
                updatedBy: null,
            });
        });
    });
    (0, jest_each_1.default)([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe('[$requestDescription] PUT', ({ request, route: baseRoute, testHeaders, requestDescription, }) => {
        test('should return 401 if valid auth headers are not set', async () => {
            const response = await request
                .put(`${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`)
                .send({ sectionTypeSpecificData: { note: 'goodbye' } });
            expect(response.status).toBe(401);
        });
        test("should return 404 if case doesn't exist", async () => {
            const response = await request
                .get(`${baseRoute}${getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId)}`)
                .set(testHeaders)
                .send({ sectionTypeSpecificData: { note: 'goodbye' } });
            expect(response.status).toBe(404);
        });
        test("should return 404 if case section doesn't exist", async () => {
            const response = await request
                .get(`${baseRoute}${getRoutePath(targetCase.id, 'note', 'nothing-here')}`)
                .set(testHeaders)
                .send({ sectionTypeSpecificData: { note: 'goodbye' } });
            expect(response.status).toBe(404);
        });
        const testCases = [
            {
                description: 'sectionTypeSpecificData should be replaced with that specified in the payload',
                newSection: { sectionTypeSpecificData: { note: 'goodbye' } },
            },
            {
                description: 'any created info specified should be ignored and the original created info should not be changed',
                newSection: {
                    sectionTypeSpecificData: { note: 'goodbye' },
                    createdBy: 'fake news',
                    createdAt: '1979-04-21',
                },
            },
            {
                description: 'any update info should be ignored and the user credentials & current time should be used instead',
                newSection: {
                    sectionTypeSpecificData: { note: 'goodbye' },
                    updatedBy: 'fake news',
                    updatedAt: '2079-04-21',
                },
            },
        ];
        (0, jest_each_1.default)(testCases).test('$description', async ({ newSection }) => {
            const startTime = Date.now();
            const response = await request
                .put(`${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`)
                .set(testHeaders)
                .send(newSection);
            expect(response.status).toBe(200);
            const apiSection = response.body;
            expect(apiSection).toEqual({
                ...newSection, // Will overwrite sectionId expectation if specified
                sectionId: targetSection.sectionId,
                sectionType: 'note',
                createdAt: expect.toParseAsDate(targetSection.createdAt),
                eventTimestamp: expect.toParseAsDate(targetSection.eventTimestamp),
                createdBy: mocks_1.workerSid,
                updatedBy: requestDescription === 'PUBLIC' ? mocks_1.workerSid : `account-${mocks_1.accountSid}`,
                updatedAt: expect.toParseAsDate(),
            });
            const updatedCase = await (0, caseService_1.getCase)(targetCase.id, mocks_1.accountSid, mocks_1.ALWAYS_CAN);
            // Test that parent case updatedAt is bumped
            expect(new Date(updatedCase.updatedAt).getTime()).toBeGreaterThan(startTime);
            const updatedSection = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', targetSection.sectionId);
            const { sectionId, ...expectedSection } = apiSection;
            expect(updatedSection).toEqual({
                ...expectedSection,
                createdAt: expect.toParseAsDate(apiSection.createdAt),
                updatedAt: expect.toParseAsDate(apiSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
            });
        });
    });
    (0, jest_each_1.default)([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe('[$requestDescription] DELETE', ({ request, route: baseRoute, testHeaders }) => {
        const verifySectionWasntDeleted = async () => {
            const { sectionId, ...expectedSection } = targetSection;
            const section = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', targetSection.sectionId);
            expect(section).toEqual(expectedSection);
        };
        test('should return 401 if valid auth headers are not set', async () => {
            const response = await request.delete(`${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`);
            expect(response.status).toBe(401);
            await verifySectionWasntDeleted();
        });
        test("should return 404 if case doesn't exist", async () => {
            const response = await request
                .delete(`${baseRoute}${getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId)}`)
                .set(testHeaders);
            expect(response.status).toBe(404);
            await verifySectionWasntDeleted();
        });
        test("should return 404 if case section doesn't exist", async () => {
            const response = await request
                .delete(`${baseRoute}${getRoutePath(targetCase.id, 'note', 'nothing-here')}`)
                .set(testHeaders);
            expect(response.status).toBe(404);
            await verifySectionWasntDeleted();
        });
        test('should return a 200, delete the case & return the deleted section when it exists', async () => {
            const startTime = Date.now();
            const response = await request
                .delete(`${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`)
                .set(testHeaders);
            expect(response.status).toBe(200);
            const section = await (0, caseSectionService_1.getCaseSection)(mocks_1.accountSid, targetCase.id.toString(), 'note', targetSection.sectionId);
            expect(section).not.toBeDefined();
            const updatedCase = await (0, caseService_1.getCase)(targetCase.id, targetCase.accountSid, mocks_1.ALWAYS_CAN);
            // Test that parent case updatedAt is bumped
            expect(new Date(updatedCase.updatedAt).getTime()).toBeGreaterThan(startTime);
        });
    });
});
