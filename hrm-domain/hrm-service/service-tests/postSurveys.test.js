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
const mocks = __importStar(require("./mocks"));
const dbConnection_1 = require("./dbConnection");
const postSurveyDataAccess_1 = require("@tech-matters/hrm-core/post-survey/postSurveyDataAccess");
const server_1 = require("./server");
const setupServiceTest_1 = require("./setupServiceTest");
const { accountSid } = mocks;
const countPostSurveys = async (contactTaskId, taskId) => {
    const row = await dbConnection_1.db.task(connection => connection.any(`
        SELECT COUNT(*) FROM "PostSurveys" WHERE "accountSid" = $<accountSid> AND "contactTaskId" = $<contactTaskId> AND "taskId" = $<taskId>
    `, { accountSid, contactTaskId, taskId }));
    return parseInt(row[0].count);
};
const { request } = (0, setupServiceTest_1.setupServiceTests)();
describe('/postSurveys route', () => {
    const route = `/v0/accounts/${accountSid}/postSurveys`;
    describe('/postSurveys/contactTaskId/:id route', () => {
        const body = {
            helpline: 'helpline',
            contactTaskId: 'WTaaaaaaaaaa',
            taskId: 'WTbbbbbbbbbb',
            data: { question: 'Some Answer' },
        };
        const subRoute = `${route}/contactTaskId`;
        const shouldExist = `${subRoute}/${body.contactTaskId}`;
        const shouldNotExist = `${subRoute}/one-that-not-exists`;
        beforeAll(async () => (0, postSurveyDataAccess_1.create)(accountSid, body));
        describe('GET', () => {
            test('should return 401', async () => {
                const response = await request.get(shouldExist);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authorization failed');
            });
            test('returns 401 if you try to use basic auth', async () => {
                const response = await request.get(shouldExist).set(server_1.basicHeaders);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authorization failed');
            });
            test('returns 401 if you try to fool it into allowing basic auth', async () => {
                const response = await request
                    .get(`${shouldExist}?x=/postSurveys`)
                    .set(server_1.basicHeaders);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authorization failed');
                const bookmarkResponse = await request
                    .get(`${shouldExist}#/postSurveys`)
                    .set(server_1.basicHeaders);
                expect(bookmarkResponse.status).toBe(401);
                expect(bookmarkResponse.body.error).toBe('Authorization failed');
            });
            test('should return 200 (no matches)', async () => {
                const response = await request.get(shouldNotExist).set(server_1.headers);
                expect(response.status).toBe(200);
                expect(response.body).toHaveLength(0);
            });
            test('should return 200 (at least one match)', async () => {
                const response = await request.get(shouldExist).set(server_1.headers);
                expect(response.status).toBe(200);
                expect(response.body).not.toHaveLength(0);
            });
        });
    });
    // First test post so database wont be empty
    describe('POST', () => {
        const helpline = 'helpline';
        const contactTaskId = 'WTxxxxxxxxxx';
        const taskId = 'WTyyyyyyyyyy';
        const data = { other_question: 'Some Other Answer' };
        const body = { helpline, contactTaskId, taskId, data };
        test('no auth should return 401', async () => {
            const response = await request.post(route).send(body);
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        test('Valid bearer auth should add post survey to DB', async () => {
            const response = await request.post(route).set(server_1.headers).send(body);
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(body.data);
            const matchingRowsCount = await countPostSurveys(contactTaskId, taskId);
            expect(matchingRowsCount).toBe(1);
        });
        test('Invalid basic auth should return 401', async () => {
            const response = await request
                .post(route)
                .set({ ...server_1.basicHeaders, Authorization: 'Basic ZX18' })
                .send(body);
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        test('Valid basic auth should add post survey to DB', async () => {
            const response = await request.post(route).set(server_1.basicHeaders).send(body);
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(body.data);
            const matchingRowsCount = await countPostSurveys(contactTaskId, taskId);
            expect(matchingRowsCount).toBe(2);
        });
    });
});
