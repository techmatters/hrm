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
const jest_each_1 = __importDefault(require("jest-each"));
const index_1 = require("@tech-matters/hrm-core/permissions/index");
const mocks_1 = require("./mocks");
const server_1 = require("./server");
const conversationMedia_1 = require("@tech-matters/hrm-core/conversation-media/conversationMedia");
const contactDB = __importStar(require("@tech-matters/hrm-core/contact/contactDataAccess"));
const conversationMediaDB = __importStar(require("@tech-matters/hrm-core/conversation-media/conversationMediaDataAccess"));
const setupServiceTest_1 = require("./setupServiceTest");
const { request } = (0, setupServiceTest_1.setupServiceTestsWithConfig)({
    serverConfig: {
        permissions: undefined,
    },
});
describe('/permissions route', () => {
    describe('GET', () => {
        (0, jest_each_1.default)([
            {
                headersConfig: {},
                accountSid: 'notConfigured',
                description: 'Should return status 401 (Authorization failed)',
                expectedStatus: 401,
            },
            {
                accountSid: 'notConfigured',
                description: 'Should return status 500 (permissions env var set to empty value)',
                expectedStatus: 500,
            },
            {
                accountSid: 'missingInEnvVars',
                description: 'Should return status 500 (permissions env var missing)',
                expectedStatus: 500,
            },
            {
                accountSid: 'notExistsInRulesMap',
                description: 'Should return status 500 (permissions env var is set but no match found in rulesMap)',
                expectedStatus: 500,
            },
            ...Object.entries(index_1.rulesMap).map(([key, rules]) => ({
                accountSid: `AC${key}`,
                description: `Should return status 200 with ${key} permissions`,
                expectedStatus: 200,
                expectedPayload: rules,
            })),
        ]).test('$description', async ({ accountSid, headersConfig = server_1.headers, expectedStatus, expectedPayload = undefined, }) => {
            const response = await request
                .get(`/v0/accounts/${accountSid}/permissions`) // env vars for fake accountsSids set in setTestEnvVars.js
                .set(headersConfig);
            expect(response.status).toBe(expectedStatus);
            if (expectedStatus === 200)
                expect(response.body).toMatchObject(expectedPayload);
        });
    });
});
describe('/permissions/:action route with contact objectType', () => {
    const accountSids = ['ACopen', 'ACclosed'];
    let createdContacts = {
        ACopen: null,
        ACclosed: null,
    };
    const bucket = 'bucket';
    const key = 'key';
    beforeEach(async () => {
        await Promise.all(accountSids.map(async (accountSid) => {
            const cm1 = {
                storeType: 'S3',
                storeTypeSpecificData: {
                    type: conversationMedia_1.S3ContactMediaType.TRANSCRIPT,
                    location: { bucket, key },
                },
            };
            const cm2 = {
                storeType: 'S3',
                storeTypeSpecificData: {
                    type: conversationMedia_1.S3ContactMediaType.RECORDING,
                    location: { bucket, key },
                },
            };
            const contact = {
                ...mocks_1.withTaskId,
                channel: 'web',
                taskId: `${mocks_1.withTaskId.taskId}-${accountSid}`,
                timeOfContact: new Date().toISOString(),
                channelSid: 'channelSid',
                serviceSid: 'serviceSid',
            };
            const { contact: createdContact } = (await contactDB.create()(accountSid, contact)).unwrap();
            createdContacts[accountSid] = createdContact;
            await Promise.all([cm1, cm2].map(async (cm) => {
                await conversationMediaDB.create()(accountSid, {
                    ...cm,
                    contactId: createdContact.id,
                });
            }));
        }));
    });
    (0, jest_each_1.default)(accountSids
        .flatMap(accountSid => [
        {
            action: index_1.actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
            accountSid,
            shouldHavePermission: accountSid === 'ACopen',
        },
        {
            action: index_1.actionsMaps.contact.VIEW_RECORDING,
            accountSid,
            shouldHavePermission: accountSid === 'ACopen',
        },
    ])
        .flatMap(testCase => [
        { ...testCase, key: 'invalid', bucket, shouldBeValid: false },
        { ...testCase, key, bucket: 'invalid', shouldBeValid: false },
        { ...testCase, key, bucket, shouldBeValid: true },
    ])
        .map(testCase => ({
        ...testCase,
        expectedStatusCode: testCase.shouldHavePermission && testCase.shouldBeValid ? 200 : 403,
    }))).test('when action is $action, permissions validity is $shouldHavePermission, location validity is $shouldBeValid - then expect $expectedStatusCode', 
    // eslint-disable-next-line @typescript-eslint/no-shadow
    async ({ action, accountSid, bucket, key, expectedStatusCode }) => {
        const contact = createdContacts[accountSid];
        const objectId = contact.id;
        const route = `/v0/accounts/${accountSid}/permissions/${action}?objectType=contact&objectId=${objectId}&bucket=${bucket}&key=${key}`;
        const res = await request.get(route).set(server_1.headers);
        expect(res.statusCode).toBe(expectedStatusCode);
    });
});
