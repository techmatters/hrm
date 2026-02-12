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
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const caseDb = __importStar(require("@tech-matters/hrm-core/case/caseDataAccess"));
const mocks = __importStar(require("../mocks"));
const server_1 = require("../server");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const mocks_1 = require("../mocks");
const mocks_2 = require("../mocks");
const setupServiceTest_1 = require("../setupServiceTest");
const { case1, case2, accountSid, workerSid } = mocks;
const { request } = (0, setupServiceTest_1.setupServiceTests)(workerSid);
describe('/cases route', () => {
    const route = `/v0/accounts/${accountSid}/cases`;
    describe('POST', () => {
        const expected = {
            ...case1,
            id: expect.anything(),
            updatedAt: expect.toParseAsDate(),
            createdAt: expect.toParseAsDate(),
            precalculatedPermissions: {
                userOwnsContact: false,
            },
            updatedBy: null,
            statusUpdatedAt: null,
            statusUpdatedBy: null,
            previousStatus: null,
            label: 'Created case',
            info: {
                operatingArea: 'East',
            },
        };
        test('should return 401', async () => {
            const response = await request.post(route).send(case1);
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        test('should return 200', async () => {
            const response = await request
                .post(route)
                .set(server_1.headers)
                .send({ ...case1, label: 'Created case' });
            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual(expected);
            // Check the DB is actually updated
            const fromDb = await caseApi.getCase(response.body.id, accountSid, mocks_1.ALWAYS_CAN);
            expect(fromDb).toStrictEqual(expected);
        });
    });
    describe('/cases/:id route', () => {
        const cases = {};
        let nonExistingCaseId;
        let subRoute;
        beforeEach(async () => {
            cases.blank = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
            cases.populated = await caseApi.createCase(mocks_2.casePopulated, accountSid, workerSid, undefined, true);
            subRoute = id => `${route}/${id}`;
            const caseToBeDeleted = await caseApi.createCase(case2, accountSid, workerSid, undefined, true);
            nonExistingCaseId = caseToBeDeleted.id;
            await caseDb.deleteById(parseInt(caseToBeDeleted.id), accountSid);
        });
        describe('GET', () => {
            test('should return 401', async () => {
                const response = await request
                    .put(subRoute(cases.blank.id.toString()))
                    .send(case1);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authorization failed');
            });
            test('should return 404', async () => {
                const response = await request
                    .get(subRoute('0000')) // Imposible to exist case
                    .set({ ...server_1.headers });
                expect(response.status).toBe(404);
                expect(response.body.error).toContain('NotFoundError: Not Found');
            });
            test('Should return 200', async () => {
                const response = await request
                    .get(subRoute(cases.populated.id))
                    .set({ ...server_1.headers });
                expect(response.status).toBe(200);
                const expected = {
                    ...cases.populated,
                    createdAt: expect.toParseAsDate(cases.populated.createdAt),
                    updatedAt: expect.toParseAsDate(cases.populated.createdAt),
                };
                expect(response.body).toMatchObject(expected);
            });
        });
        describe('DELETE', () => {
            test('should return 401', async () => {
                const response = await request.delete(subRoute(cases.blank.id)).send();
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authorization failed');
            });
            test('should return 200', async () => {
                const response = await request
                    .delete(subRoute(cases.blank.id))
                    .set(server_1.headers)
                    .send();
                expect(response.status).toBe(200);
                // Check the DB is actually updated
                const fromDb = await caseDb.getById(parseInt(cases.blank.id), accountSid, (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, ['supervisor']));
                expect(fromDb).toBeFalsy();
            });
            test('should return 404', async () => {
                const response = await request
                    .delete(subRoute(nonExistingCaseId))
                    .set(server_1.headers)
                    .send();
                expect(response.status).toBe(404);
            });
        });
    });
});
