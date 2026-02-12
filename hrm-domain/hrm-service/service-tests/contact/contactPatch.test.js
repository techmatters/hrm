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
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const contactService_1 = require("@tech-matters/hrm-core/contact/contactService");
require("../case/caseValidation");
const mocks = __importStar(require("../mocks"));
const mocks_1 = require("../mocks");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const jest_each_1 = __importDefault(require("jest-each"));
const server_1 = require("../server");
const permissions_overrides_1 = require("../permissions-overrides");
const conversationMediaDataAccess_1 = require("@tech-matters/hrm-core/conversation-media/conversationMediaDataAccess");
const testing_1 = require("@tech-matters/testing");
const dbCleanup_1 = require("./dbCleanup");
const finalizeContact_1 = require("./finalizeContact");
const setupServiceTest_1 = require("../setupServiceTest");
const { request } = (0, setupServiceTest_1.setupServiceTests)();
const route = `/v0/accounts/${mocks_1.accountSid}/contacts`;
beforeEach(async () => {
    const mockttp = await testing_1.mockingProxy.mockttpServer();
    await (0, testing_1.mockSsmParameters)(mockttp, [
        { pathPattern: /.*\/auth_token$/, valueGenerator: () => 'mockAuthToken' },
    ]);
});
describe('/contacts/:contactId route', () => {
    describe('PATCH', () => {
        const subRoute = contactId => `${route}/${contactId}`;
        test('should return 401', async () => {
            let createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, {
                ...mocks_1.contact1,
                rawJson: {},
            }, mocks_1.ALWAYS_CAN, true);
            createdContact = await (0, finalizeContact_1.finalizeContact)(createdContact);
            const response = await request.patch(subRoute(createdContact.id)).send({});
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        describe('rawJson is updated to be compatible', () => {
            const sampleRawJson = {
                ...mocks_1.contact1.rawJson,
                categories: {
                    a: ['a2'],
                    b: ['b1'],
                },
            };
            const tests = [
                {
                    description: 'set callType to data call type',
                    patch: {
                        callType: 'Child calling about self',
                    },
                    expected: {
                        callType: 'Child calling about self',
                    },
                },
                {
                    description: 'set callType to non data call type',
                    patch: {
                        callType: 'Hang up',
                    },
                    expected: {
                        callType: 'Hang up',
                    },
                },
                {
                    description: 'add child information',
                    patch: {
                        childInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'property',
                        },
                    },
                    expected: {
                        childInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'property',
                        },
                    },
                },
                {
                    description: 'add caller information',
                    patch: {
                        callerInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'other property',
                        },
                    },
                    expected: {
                        callerInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'other property',
                        },
                    },
                },
                {
                    description: 'add case information and categories',
                    patch: {
                        caseInformation: {
                            other: 'case property',
                        },
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                    expected: {
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                        caseInformation: {
                            other: 'case property',
                        },
                    },
                },
                {
                    description: 'add case information',
                    patch: {
                        caseInformation: {
                            other: 'case property',
                        },
                    },
                    expected: {
                        caseInformation: {
                            other: 'case property',
                        },
                    },
                },
                {
                    description: 'add categories',
                    patch: {
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                    expected: {
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                },
                {
                    description: 'overwrite callType as data call type',
                    original: sampleRawJson,
                    patch: {
                        callType: 'Child calling about self',
                    },
                    expected: {
                        ...sampleRawJson,
                        callType: 'Child calling about self',
                    },
                },
                {
                    description: 'overwrite callType as non data call type',
                    original: sampleRawJson,
                    patch: {
                        callType: 'Hang up',
                    },
                    expected: {
                        ...sampleRawJson,
                        callType: 'Hang up',
                    },
                },
                {
                    description: 'overwrite child information',
                    original: sampleRawJson,
                    patch: {
                        childInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'property',
                        },
                    },
                    expected: {
                        ...sampleRawJson,
                        childInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'property',
                        },
                    },
                },
                {
                    original: sampleRawJson,
                    description: 'overwrite caller information',
                    patch: {
                        callerInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'other property',
                        },
                    },
                    expected: {
                        ...sampleRawJson,
                        callerInformation: {
                            firstName: 'Lorna',
                            lastName: 'Ballantyne',
                            some: 'other property',
                        },
                    },
                },
                {
                    original: sampleRawJson,
                    description: 'overwrite case information and categories',
                    patch: {
                        caseInformation: {
                            other: 'overwrite case property',
                        },
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                    expected: {
                        ...sampleRawJson,
                        caseInformation: {
                            other: 'overwrite case property',
                        },
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                },
                {
                    original: sampleRawJson,
                    description: 'overwrite case information',
                    patch: {
                        caseInformation: {
                            other: 'case property',
                        },
                    },
                    expected: {
                        ...sampleRawJson,
                        caseInformation: {
                            other: 'case property',
                        },
                    },
                },
                {
                    original: sampleRawJson,
                    description: 'overwrite categories',
                    patch: {
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                    expected: {
                        ...sampleRawJson,
                        categories: {
                            category1: ['subcategory1', 'subcategory2'],
                        },
                    },
                },
            ];
            (0, jest_each_1.default)(tests).test('should $description if that is specified in the payload', async ({ patch, expected, original }) => {
                let createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, {
                    ...mocks_1.contact1,
                    rawJson: original || {},
                }, mocks_1.ALWAYS_CAN, true);
                createdContact = await (0, finalizeContact_1.finalizeContact)(createdContact);
                const existingContactId = createdContact.id;
                const response = await request
                    .patch(subRoute(existingContactId))
                    .set(server_1.headers)
                    .send({ rawJson: patch });
                expect(response.status).toBe(200);
                expect(response.body).toStrictEqual({
                    ...createdContact,
                    timeOfContact: expect.toParseAsDate(createdContact.timeOfContact),
                    createdAt: expect.toParseAsDate(createdContact.createdAt),
                    finalizedAt: expect.toParseAsDate(createdContact.finalizedAt),
                    updatedAt: expect.toParseAsDate(),
                    updatedBy: mocks_1.workerSid,
                    rawJson: expected,
                    conversationMedia: [],
                    csamReports: [],
                    referrals: [],
                });
                // Test the association
                expect(response.body.csamReports).toHaveLength(0);
                const savedContact = await contactApi.getContactById(mocks_1.accountSid, existingContactId, mocks_1.ALWAYS_CAN);
                expect(savedContact).toStrictEqual({
                    ...createdContact,
                    createdAt: expect.toParseAsDate(createdContact.createdAt),
                    updatedAt: expect.toParseAsDate(),
                    updatedBy: mocks_1.workerSid,
                    rawJson: expected,
                    conversationMedia: [],
                    csamReports: [],
                    referrals: [],
                });
            });
        });
        describe('Changes outside rawJson', () => {
            beforeEach(async () => {
                // Clean what's been created so far
                await (0, dbCleanup_1.cleanupCsamReports)();
                await (0, dbCleanup_1.cleanupReferrals)();
                await (0, dbCleanup_1.cleanupContactsJobs)();
                await (0, dbCleanup_1.cleanupContacts)();
                await (0, dbCleanup_1.cleanupCases)();
            });
            test('Not permitted on finalized contact', async () => {
                let createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
                createdContact = await (0, finalizeContact_1.finalizeContact)(createdContact);
                const response = await request
                    .patch(subRoute(createdContact.id))
                    .set(server_1.headers)
                    .send({ conversationDuration: 1337 });
                expect(response.status).toBe(403);
            });
            const testCases = [
                {
                    description: 'patches conversationDuration',
                    patch: {
                        conversationDuration: 1337,
                    },
                    expectedDifferences: {
                        conversationDuration: 1337,
                    },
                    originalDifferences: {
                        conversationDuration: 42,
                    },
                },
                {
                    description: 'finalize contact',
                    finalize: true,
                    patch: {
                        conversationDuration: 1337,
                    },
                    expectedDifferences: {
                        conversationDuration: 1337,
                        finalizedAt: expect.toParseAsDate(),
                    },
                    originalDifferences: {
                        conversationDuration: 42,
                    },
                },
            ];
            (0, jest_each_1.default)(testCases).test('should $description if that is specified in the payload for a draft contact', async ({ patch, expectedDifferences, originalDifferences, finalize = false, }) => {
                const original = {
                    ...mocks_1.contact1,
                    ...originalDifferences,
                    rawJson: {
                        ...mocks_1.contact1.rawJson,
                        ...originalDifferences?.rawJson,
                    },
                };
                const createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, original, mocks_1.ALWAYS_CAN, true);
                const expected = {
                    ...createdContact,
                    ...expectedDifferences,
                    rawJson: {
                        ...createdContact.rawJson,
                        ...expectedDifferences?.rawJson,
                        caseInformation: {
                            ...createdContact.rawJson.caseInformation,
                            ...expectedDifferences?.rawJson?.caseInformation,
                        },
                    },
                };
                const existingContactId = createdContact.id;
                const response = await request
                    .patch(`${subRoute(existingContactId)}?finalize=${finalize}`)
                    .set(server_1.headers)
                    .send(patch);
                expect(response.status).toBe(200);
                expect(response.body).toStrictEqual({
                    ...expected,
                    timeOfContact: expect.toParseAsDate(expected.timeOfContact),
                    createdAt: expect.toParseAsDate(expected.createdAt),
                    updatedAt: expect.toParseAsDate(),
                    updatedBy: mocks_1.workerSid,
                    referrals: [],
                    conversationMedia: [],
                });
                // Test the association
                expect(response.body.csamReports).toHaveLength(0);
                const savedContact = await contactApi.getContactById(mocks_1.accountSid, existingContactId, mocks_1.ALWAYS_CAN);
                expect(savedContact).toStrictEqual({
                    ...expected,
                    createdAt: expect.toParseAsDate(createdContact.createdAt),
                    updatedAt: expect.toParseAsDate(),
                    updatedBy: mocks_1.workerSid,
                    csamReports: [],
                    referrals: [],
                    conversationMedia: [],
                });
            });
        });
        test('use non-existent contactId should return 404', async () => {
            const contactToBeDeleted = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
            const nonExistingContactId = contactToBeDeleted.id;
            await (0, dbCleanup_1.deleteContactById)(parseInt(contactToBeDeleted.id), contactToBeDeleted.accountSid);
            const response = await request
                .patch(subRoute(nonExistingContactId))
                .set(server_1.headers)
                .send({
                rawJson: {
                    name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                    some: 'property',
                },
            });
            expect(response.status).toBe(404);
        });
        test("Draft contact edited by a user that didn't create or own the contact - returns 403", async () => {
            const createdContact = await contactApi.createContact(mocks_1.accountSid, 'WK another creator', {
                ...mocks_1.contact1,
                twilioWorkerId: 'another owner',
            }, { ...mocks_1.ALWAYS_CAN, user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, 'WK another creator', []) }, true);
            const response = await request
                .patch(subRoute(createdContact.id))
                .set(server_1.headers)
                .send();
            expect(response.status).toBe(403);
        });
        test('Draft contact edited by a user that owns the contact - returns 200', async () => {
            const createdContact = await contactApi.createContact(mocks_1.accountSid, 'WK another creator', mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
            const response = await request
                .patch(subRoute(createdContact.id))
                .set(server_1.headers)
                .send();
            expect(response.status).toBe(200);
        });
        test('Draft contact edited by a user that created the contact - returns 200', async () => {
            const createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, {
                ...mocks_1.contact1,
                twilioWorkerId: 'another owner',
            }, mocks_1.ALWAYS_CAN, true);
            const response = await request
                .patch(subRoute(createdContact.id))
                .set(server_1.headers)
                .send();
            expect(response.status).toBe(200);
        });
        test('malformed payload should return 400', async () => {
            let contact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, { ...mocks_1.contact1, taskId: 'malformed-task-id' }, mocks_1.ALWAYS_CAN, true);
            contact = await (0, finalizeContact_1.finalizeContact)(contact);
            const response = await request.patch(subRoute(contact.id)).set(server_1.headers).send([]);
            expect(response.status).toBe(400);
        });
        test('no body should be a noop', async () => {
            let createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
            createdContact = await (0, finalizeContact_1.finalizeContact)(createdContact);
            const response = await request
                .patch(subRoute(createdContact.id))
                .set(server_1.headers)
                .send();
            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual({
                ...createdContact,
                timeOfContact: expect.toParseAsDate(createdContact.timeOfContact),
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                finalizedAt: expect.toParseAsDate(createdContact.finalizedAt),
                updatedAt: expect.toParseAsDate(),
                updatedBy: mocks_1.workerSid,
                conversationMedia: [],
            });
        });
        (0, jest_each_1.default)([
            {
                expectTranscripts: true,
                description: `with viewExternalTranscript includes transcripts`,
            },
            {
                expectTranscripts: false,
                description: `without viewExternalTranscript excludes transcripts`,
            },
        ]).test(`$description`, async ({ expectTranscripts }) => {
            const permission = mocks_1.ALWAYS_CAN;
            let createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.withTaskId, permission, true);
            createdContact = await (0, contactService_1.addConversationMediaToContact)(mocks_1.accountSid, createdContact.id.toString(), mocks.conversationMedia, permission);
            createdContact = await (0, finalizeContact_1.finalizeContact)(createdContact);
            (0, server_1.useOpenRules)();
            if (!expectTranscripts) {
                (0, server_1.setRules)((0, permissions_overrides_1.ruleFileActionOverride)('viewExternalTranscript', false));
            }
            const res = await request
                .patch(`${route}/${createdContact.id}`)
                .set(server_1.headers)
                .send({ rawJson: createdContact.rawJson });
            expect(res.status).toBe(200);
            if (expectTranscripts) {
                expect(res.body.conversationMedia?.some(conversationMediaDataAccess_1.isS3StoredTranscript)).toBeTruthy();
            }
            else {
                expect(res.body.conversationMedia?.some(conversationMediaDataAccess_1.isS3StoredTranscript)).toBeFalsy();
            }
        });
    });
});
