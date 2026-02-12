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
require("../case/caseValidation");
const mocks_1 = require("../mocks");
const server_1 = require("../server");
const conversationMediaDataAccess_1 = require("@tech-matters/hrm-core/conversation-media/conversationMediaDataAccess");
const jest_each_1 = __importDefault(require("jest-each"));
const ContactJob_1 = require("@tech-matters/types/ContactJob");
const permissions_overrides_1 = require("../permissions-overrides");
const db_validations_1 = require("./db-validations");
const setupServiceTest_1 = require("../setupServiceTest");
(0, server_1.useOpenRules)();
const route = `/v0/accounts/${mocks_1.accountSid}/contacts`;
let createdContact;
const { request } = (0, setupServiceTest_1.setupServiceTests)();
beforeEach(async () => {
    createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, {
        ...mocks_1.contact1,
        rawJson: {},
    }, mocks_1.ALWAYS_CAN, true);
});
describe('/contacts/:contactId/conversationMedia route', () => {
    const subRoute = contactId => `${route}/${contactId}/conversationMedia`;
    describe('POST', () => {
        test('should return 401 if user is not authenticated', async () => {
            const items = [
                {
                    storeType: 'S3',
                    storeTypeSpecificData: {
                        type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                        location: {
                            bucket: 'bucket',
                            key: 'key',
                        },
                    },
                },
            ];
            const response = await request.post(subRoute(createdContact.id)).send(items);
            expect(response.status).toBe(401);
        });
        test("should return 404 if contact doesn't exist", async () => {
            const items = [
                {
                    storeType: 'S3',
                    storeTypeSpecificData: {
                        type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                        location: {
                            bucket: 'bucket',
                            key: 'key',
                        },
                    },
                },
            ];
            const response = await request
                .post(subRoute(createdContact.id + 100))
                .set(server_1.headers)
                .send(items);
            expect(response.status).toBe(404);
        });
        const testCases = [
            {
                description: 'single media item added to contact with none - contact should have the new conversation media',
                postedMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                ],
                expectedContactMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                ],
            },
            {
                description: 'multiple media items added to contact with none - contact should have the new conversation media',
                postedMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.RECORDING,
                            location: {
                                bucket: 'bucket',
                                key: 'key2',
                            },
                        },
                    },
                ],
            },
            {
                description: 'multiple media items added to contact with some already - contact should have all the conversation media',
                existingMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'existing-bucket',
                                key: 'existing-key',
                            },
                        },
                    },
                ],
                postedMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.RECORDING,
                            location: {
                                bucket: 'bucket',
                                key: 'key2',
                            },
                        },
                    },
                ],
                expectedContactMedia: [
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'existing-bucket',
                                key: 'existing-key',
                            },
                        },
                    },
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.RECORDING,
                            location: {
                                bucket: 'bucket',
                                key: 'key2',
                            },
                        },
                    },
                ],
            },
        ];
        (0, jest_each_1.default)(testCases).test('$description and return 200', async ({ expectedContactMedia, postedMedia, existingMedia }) => {
            if (existingMedia) {
                createdContact = (await request
                    .post(subRoute(createdContact.id))
                    .set(server_1.headers)
                    .send(existingMedia)).body;
            }
            const fullExpectedContactMedia = (expectedContactMedia ?? postedMedia).map(media => ({
                ...media,
                createdAt: expect.toParseAsDate(),
                updatedAt: expect.toParseAsDate(),
                contactId: parseInt(createdContact.id),
                id: expect.any(Number),
                accountSid: mocks_1.accountSid,
            }));
            const expectedResponse = {
                ...createdContact,
                createdAt: expect.toParseAsDate(),
                finalizedAt: expect.toParseAsDate(),
                updatedAt: expect.toParseAsDate(),
                timeOfContact: expect.toParseAsDate(),
                conversationMedia: expect.arrayContaining(fullExpectedContactMedia),
            };
            const response = await request
                .post(subRoute(createdContact.id))
                .set(server_1.headers)
                .send(postedMedia);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResponse);
            const checkResponse = await request
                .get(`${route}/byTaskSid/${createdContact.taskId}`)
                .set(server_1.headers)
                .send(postedMedia);
            expect(checkResponse.status).toBe(200);
            expect(checkResponse.body).toEqual(expectedResponse);
            expect(checkResponse.body.conversationMedia.length).toEqual(fullExpectedContactMedia.length);
        });
        describe('Contact Jobs', () => {
            test(`Adding transcripts to contacts with channel type $channel should create ${ContactJob_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job`, async () => {
                const { body: channelContact } = await request
                    .post(route)
                    .set(server_1.headers)
                    .send(mocks_1.contact1);
                await request
                    .post(subRoute(channelContact.id))
                    .set(server_1.headers)
                    .send([
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                        },
                    },
                ]);
                const jobs = await (0, db_validations_1.selectJobsByContactId)(channelContact.id, mocks_1.accountSid);
                const retrieveContactTranscriptJobs = jobs.filter(j => j.jobType === ContactJob_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
                expect(retrieveContactTranscriptJobs).toHaveLength(1);
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
                (0, server_1.useOpenRules)();
                if (!expectTranscripts) {
                    (0, server_1.setRules)((0, permissions_overrides_1.ruleFileActionOverride)('viewExternalTranscript', false));
                }
                const { body: contactWithMedia } = await request
                    .post(subRoute(createdContact.id))
                    .set(server_1.headers)
                    .send([
                    {
                        storeType: 'S3',
                        storeTypeSpecificData: {
                            type: conversationMediaDataAccess_1.S3ContactMediaType.TRANSCRIPT,
                            location: {
                                bucket: 'bucket',
                                key: 'key',
                            },
                        },
                    },
                ]);
                if (expectTranscripts) {
                    expect(contactWithMedia.conversationMedia?.some(conversationMediaDataAccess_1.isS3StoredTranscript)).toBeTruthy();
                }
                else {
                    expect(contactWithMedia.conversationMedia?.some(conversationMediaDataAccess_1.isS3StoredTranscript)).toBeFalsy();
                }
            });
        });
    });
});
