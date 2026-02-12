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
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
require("../case/caseValidation");
const mocks_1 = require("../mocks");
const server_1 = require("../server");
const setupServiceTest_1 = require("../setupServiceTest");
const route = `/v0/accounts/${mocks_1.accountSid}/contacts`;
let createdContact;
const { request } = (0, setupServiceTest_1.setupServiceTests)();
beforeEach(async () => {
    createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, {
        ...mocks_1.contact1,
        rawJson: {},
    }, mocks_1.ALWAYS_CAN, true);
});
describe('/contacts/byTaskSid/:contactId route', () => {
    const subRoute = taskSid => `${route}/byTaskSid/${taskSid}`;
    describe('GET', () => {
        test('should return 401 if user is not authenticated', async () => {
            const response = await request.get(subRoute(createdContact.id));
            expect(response.status).toBe(401);
        });
        test("should return 404 if contact doesn't exist", async () => {
            const response = await request.get(subRoute('not a task')).set(server_1.headers);
            expect(response.status).toBe(404);
        });
        test('Should find correct contact by task and return with a 200 code if it exists and the user is authenticated', async () => {
            const response = await request.get(subRoute(createdContact.taskId)).set(server_1.headers);
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                ...createdContact,
                createdAt: expect.toParseAsDate(),
                finalizedAt: expect.toParseAsDate(),
                updatedAt: expect.toParseAsDate(),
                timeOfContact: expect.toParseAsDate(),
                rawJson: {
                    ...createdContact.rawJson,
                },
                conversationMedia: [],
            });
        });
    });
});
