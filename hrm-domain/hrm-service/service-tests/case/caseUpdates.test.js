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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
const jest_each_1 = __importDefault(require("jest-each"));
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const caseDb = __importStar(require("@tech-matters/hrm-core/case/caseDataAccess"));
const date_fns_1 = require("date-fns");
const testing_1 = require("@tech-matters/testing");
const mocks = __importStar(require("../mocks"));
const mocks_1 = require("../mocks");
const server_1 = require("../server");
const setupServiceTest_1 = require("../setupServiceTest");
const { case1, case2, accountSid, workerSid } = mocks;
const { internalRequest, request: publicRequest } = (0, setupServiceTest_1.setupServiceTests)(workerSid);
const cases = {};
let nonExistingCaseId;
const caseBaseRoute = `/v0/accounts/${accountSid}/cases`;
beforeEach(async () => {
    cases.blank = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
    cases.populated = await caseApi.createCase(mocks_1.casePopulated, accountSid, workerSid, undefined, true);
    const caseToBeDeleted = await caseApi.createCase(case2, accountSid, workerSid, undefined, true);
    nonExistingCaseId = caseToBeDeleted.id;
    await caseDb.deleteById(parseInt(caseToBeDeleted.id), accountSid);
});
const publicApiTestSuiteParameters = {
    request: publicRequest,
    requestDescription: 'PUBLIC',
    route: caseBaseRoute,
    testHeaders: server_1.headers,
};
const internalApiTestSuiteParameters = {
    request: internalRequest,
    requestDescription: 'INTERNAL',
    route: `/internal${caseBaseRoute}`,
    testHeaders: server_1.basicHeaders,
};
(0, jest_each_1.default)([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe('[$requestDescription] PUT /cases/:id/status route', ({ request, route, testHeaders, requestDescription }) => {
    const subRoute = id => `${route}/${id}/status`;
    test('should return 401', async () => {
        const response = await request
            .put(subRoute(cases.blank.id))
            .send({ status: 'anxious' });
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
    });
    const testCases = [
        {
            changeDescription: 'status changed',
            newStatus: 'dappled',
            statusUpdatedAt: expect.toParseAsDate(),
            statusUpdatedBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
            previousStatus: case1.status,
        },
        {
            changeDescription: 'status changed by another counselor',
            newStatus: 'puddled',
            statusUpdatedAt: expect.toParseAsDate(),
            statusUpdatedBy: requestDescription === 'PUBLIC'
                ? 'WK-another-worker-sid'
                : `account-${accountSid}`,
            previousStatus: case1.status,
            customWorkerSid: 'WK-another-worker-sid',
        },
        {
            changeDescription: 'status changed to the same status - status tracking not updated',
            newStatus: 'open',
            statusUpdatedAt: null,
            statusUpdatedBy: null,
            previousStatus: null,
        },
    ];
    (0, jest_each_1.default)(testCases).test('should return 200 and save new status when $changeDescription', async ({ newStatus, originalCase: originalCaseGetter = () => cases.blank, customWorkerSid = undefined, statusUpdatedAt, statusUpdatedBy, previousStatus, }) => {
        if (customWorkerSid) {
            await testing_1.mockingProxy.stop();
            await testing_1.mockingProxy.start();
            await (0, testing_1.mockSuccessfulTwilioAuthentication)(customWorkerSid);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        const originalCase = originalCaseGetter();
        const caseBeforeUpdate = await caseApi.getCase(originalCase.id, accountSid, mocks_1.ALWAYS_CAN);
        const response = await request
            .put(subRoute(originalCase.id))
            .set(testHeaders)
            .send({
            status: newStatus,
        });
        expect(response.status).toBe(200);
        const expected = {
            ...originalCase,
            createdAt: expect.toParseAsDate(originalCase.createdAt),
            updatedAt: expect.toParseAsDate(),
            status: newStatus,
            updatedBy: requestDescription === 'PUBLIC'
                ? customWorkerSid || workerSid
                : `account-${accountSid}`,
            statusUpdatedAt,
            statusUpdatedBy,
            previousStatus,
        };
        expect(response.body).toMatchObject(expected);
        // Check the DB is actually updated
        const fromDb = await caseApi.getCase(originalCase.id, accountSid, mocks_1.ALWAYS_CAN);
        expect(fromDb).toMatchObject(expected);
        if (!fromDb || !caseBeforeUpdate) {
            throw new Error('fromDB is falsy');
        }
        // Check that in each case, createdAt is not changed
        expect(fromDb.createdAt).toStrictEqual(caseBeforeUpdate.createdAt);
        // Check that in each case, updatedAt is greater than createdAt
        expect((0, date_fns_1.isBefore)(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(true);
        // Check that in each case, updatedAt is greater it was before
        expect((0, date_fns_1.isBefore)(new Date(caseBeforeUpdate.updatedAt), new Date(fromDb.updatedAt))).toBe(true);
    });
    test('should return 404', async () => {
        const status = 'closed';
        const response = await request
            .put(subRoute(nonExistingCaseId))
            .set(testHeaders)
            .send({ status });
        expect(response.status).toBe(404);
    });
});
(0, jest_each_1.default)([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe('[$requestDescription] PUT /cases/:id/overview route', ({ request, route, testHeaders, requestDescription }) => {
    const subRoute = id => `${route}/${id}/overview`;
    const baselineDate = new Date('2020-01-01T00:00:00.000Z');
    test('should return 401', async () => {
        const response = await request.put(subRoute(cases.blank.id)).send({
            summary: 'wintery',
            childIsAtRisk: false,
            followUpDate: baselineDate.toISOString(),
        });
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
    });
    const testCases = [
        {
            changeDescription: 'all overview properties changed',
            newOverview: {
                summary: 'dappled',
                childIsAtRisk: false,
                followUpDate: baselineDate.toISOString(),
            },
        },
        {
            changeDescription: 'overview partially changed (omitted properties are not changed)',
            newOverview: {
                summary: 'autumnal',
            },
        },
        {
            changeDescription: 'properties other than the known overview properties are specified (unrecognised properties are ignored)',
            newOverview: {
                summary: 'autumnal',
                somethingFrom: 'behind the veil',
            },
        },
        {
            changeDescription: 'dynamic properties are now supported and saved',
            newOverview: {
                summary: 'summary is required',
                customField1: 'custom value 1',
                customField2: 'custom value 2',
            },
        },
    ];
    (0, jest_each_1.default)(testCases).test('should return 200 and save overview updates when $changeDescription', async ({ newOverview, originalCase: originalCaseGetter = () => cases.populated, }) => {
        const originalCase = originalCaseGetter();
        const caseBeforeUpdate = await caseApi.getCase(originalCase.id, accountSid, mocks_1.ALWAYS_CAN);
        const response = await request
            .put(subRoute(originalCase.id))
            .set(testHeaders)
            .send(newOverview);
        expect(response.status).toBe(200);
        const expected = {
            ...originalCase,
            info: {
                ...originalCase.info,
                ...newOverview,
            },
            updatedAt: expect.toParseAsDate(),
            updatedBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
        };
        expect(response.body).toStrictEqual(expected);
        // Check the DB is actually updated
        const fromDb = await caseApi.getCase(originalCase.id, accountSid, mocks_1.ALWAYS_CAN);
        expect(fromDb).toStrictEqual(expected);
        if (!fromDb || !caseBeforeUpdate) {
            throw new Error('fromDB is falsy');
        }
        // Check that in each case, createdAt is not changed
        expect(fromDb.createdAt).toStrictEqual(caseBeforeUpdate.createdAt);
        // Check that in each case, updatedAt is greater than createdAt
        expect((0, date_fns_1.isBefore)(new Date(fromDb.createdAt), new Date(fromDb.updatedAt))).toBe(true);
        // Check that in each case, updatedAt is greater it was before
        expect((0, date_fns_1.isBefore)(new Date(caseBeforeUpdate.updatedAt), new Date(fromDb.updatedAt))).toBe(true);
    });
    test("should return 404 if case doesn't exist", async () => {
        const response = await request
            .put(subRoute(nonExistingCaseId))
            .set(testHeaders)
            .send({
            summary: 'wintery',
            childIsAtRisk: false,
            followUpDate: baselineDate.toISOString(),
        });
        expect(response.status).toBe(404);
    });
    test('should return 400 if followUpDate is not a valid date', async () => {
        const response = await request
            .put(subRoute(cases.populated.id))
            .set(testHeaders)
            .send({
            followUpDate: 'in a bit',
        });
        expect(response.status).toBe(400);
    });
});
