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
const dbConnection_1 = require("../dbConnection");
const mocks_1 = require("../mocks");
require("../case/caseValidation");
const contactDb = __importStar(require("@tech-matters/hrm-core/contact/contactDataAccess"));
const contact_get_sql_1 = require("@tech-matters/hrm-core/contact/sql/contact-get-sql");
const server_1 = require("../server");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const profilesDB = __importStar(require("@tech-matters/hrm-core/profile/profileDataAccess"));
const profilesService = __importStar(require("@tech-matters/hrm-core/profile/profileService"));
const types_1 = require("@tech-matters/types");
const setupServiceTest_1 = require("../setupServiceTest");
// eslint-disable-next-line @typescript-eslint/no-shadow
const getContactByTaskId = (taskId, accountSid) => dbConnection_1.db.oneOrNone((0, contact_get_sql_1.selectSingleContactByTaskId)('Contacts'), { accountSid, taskId });
const { request, internalRequest } = (0, setupServiceTest_1.setupServiceTests)();
(0, jest_each_1.default)([
    {
        testRequest: request,
        route: `/v0/accounts/${mocks_1.accountSid}/contacts`,
        testHeaders: server_1.headers,
        description: 'public route',
    },
    {
        testRequest: internalRequest,
        route: `/internal/v0/accounts/${mocks_1.accountSid}/contacts`,
        testHeaders: server_1.basicHeaders,
        description: 'internal route',
    },
]).describe('POST /contacts $description', ({ testRequest, route, testHeaders }) => {
    test('should return 401', async () => {
        const response = await testRequest.post(route).send(mocks_1.contact1);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
    });
    const createContactTestCases = [
        {
            contact: mocks_1.contact1,
            changeDescription: 'callType is Child calling about self',
        },
        {
            contact: {
                ...mocks_1.contact1,
                taskId: 'contact-1-task-sid-2',
            },
            changeDescription: 'callType is Child calling about self',
        },
        {
            contact: mocks_1.contact2,
            changeDescription: 'callType is Someone calling about a child',
        },
        {
            contact: mocks_1.broken1,
            changeDescription: 'contact is non data with actual information (1) (no payload manipulation)',
        },
        {
            contact: mocks_1.broken2,
            changeDescription: 'contact is non data with actual information (2) (no payload manipulation)',
        },
        {
            contact: mocks_1.another1,
            changeDescription: 'callType is Child calling about self (with variations in the form)',
        },
        {
            contact: mocks_1.another2,
            changeDescription: 'callType is Someone calling about a child (with variations in the form)',
        },
        {
            contact: mocks_1.noHelpline,
            changeDescription: 'there is no helpline set in the payload',
        },
        {
            contact: {
                rawJson: {},
                twilioWorkerId: null,
                helpline: null,
                queueName: null,
                number: null,
                channel: null,
                conversationDuration: null,
                timeOfContact: null,
                taskId: 'empty-contact-tasksid',
                channelSid: null,
                serviceSid: null,
                definitionVersion: 'as-v1',
            },
            expectedGetContact: {
                rawJson: {},
                twilioWorkerId: null,
                helpline: '',
                queueName: null,
                number: '',
                channel: '',
                conversationDuration: null,
                taskId: 'empty-contact-tasksid',
                channelSid: '',
                serviceSid: '',
            },
            changeDescription: 'missing fields (filled with defaults)',
        },
        {
            contact: mocks_1.contact1,
            changeDescription: 'callType is Child calling about self',
            expectedGetContact: {
                ...mocks_1.contact1,
                finalizedAt: undefined,
            },
        },
    ];
    (0, jest_each_1.default)(createContactTestCases).test('should return 200 when $changeDescription', async ({ contact, expectedGetContact = null, finalize = true }) => {
        // const updateSpy = jest.spyOn(CSAMReport, 'update');
        const expected = expectedGetContact || contact;
        const res = await testRequest
            .post(`${route}?finalize=${finalize}`)
            .set(testHeaders)
            .send(contact);
        expect(res.status).toBe(200);
        expect(res.body.referrals).toStrictEqual(contact.referrals || []);
        expect(res.body.rawJson.callType).toBe(contact.rawJson.callType);
        const createdContact = await contactDb.getById(mocks_1.accountSid, res.body.id);
        expect(createdContact).toBeDefined();
        expect(createdContact.rawJson).toMatchObject(expected.rawJson);
        expect(createdContact.timeOfContact).toParseAsDate();
        expect(createdContact.createdAt).toParseAsDate();
        expect(createdContact.updatedAt).toParseAsDate();
        expect(createdContact.twilioWorkerId).toBe(expected.twilioWorkerId);
        expect(createdContact.helpline).toBe(expected.helpline);
        expect(createdContact.queueName).toBe(expected.queueName || '');
        expect(createdContact.number).toBe(expected.number);
        expect(createdContact.channel).toBe(expected.channel);
        expect(createdContact.conversationDuration).toBe(expected.conversationDuration);
        expect(createdContact.finalizedAt).toBeFalsy();
    });
    test('Idempotence on create contact', async () => {
        const response = await testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId);
        const subsequentResponse = await testRequest
            .post(route)
            .set(testHeaders)
            .send(mocks_1.withTaskId);
        // both should succeed
        expect(response.status).toBe(200);
        expect(subsequentResponse.status).toBe(200);
        // but should both return the same entity (i.e. the second call didn't create one)
        expect(subsequentResponse.body.id).toBe(response.body.id);
    });
    test('Concurrent idempotence on create contact', async () => {
        const responses = await Promise.all([
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
            testRequest.post(route).set(testHeaders).send(mocks_1.withTaskId),
        ]);
        // all should succeed
        responses.forEach(response => expect(response.status).toBe(200));
        const expectedId = responses[0].body.id;
        // but should both return the same entity (i.e. only one call created one)
        responses.forEach(response => expect(response.body.id).toBe(expectedId));
    });
    test(`If retrieving identifier and profile fails, the contact is not created either`, async () => {
        const contact = {
            ...mocks_1.withTaskId,
            rawJson: {
                ...mocks_1.withTaskId.rawJson,
            },
            channel: 'web',
            taskId: `${mocks_1.withTaskId.taskId}-identifier`,
            number: 'identifier',
        };
        jest
            .spyOn(profilesDB, 'getIdentifierWithProfiles')
            .mockImplementationOnce(() => async () => {
            throw new Error('Ups');
        });
        const res = await testRequest.post(route).set(testHeaders).send(contact);
        expect(res.status).toBe(500);
        const attemptedContact = await getContactByTaskId(contact.taskId, mocks_1.accountSid);
        expect(attemptedContact).toBeNull();
    });
    test(`If identifier and profile exist, the contact is created using them`, async () => {
        const contact = {
            ...mocks_1.withTaskId,
            rawJson: {
                ...mocks_1.withTaskId.rawJson,
            },
            channel: 'web',
            taskId: `${mocks_1.withTaskId.taskId}-identifier`,
            number: 'identifier1234',
        };
        const profileResult = await profilesService.createIdentifierAndProfile()(mocks_1.accountSid, {
            identifier: { identifier: contact.number },
            profile: { name: null, definitionVersion: 'as-v1' },
        }, { user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []) });
        if ((0, types_1.isErr)(profileResult)) {
            expect(false).toBeTruthy();
            return;
        }
        console.log('profileResult', profileResult);
        const identifierId = profileResult.data.id;
        const profileId = profileResult.data.profiles[0].id;
        // Create contact with conversation media
        const response = await testRequest.post(route).set(testHeaders).send(contact);
        expect(response.status).toBe(200);
        expect(response.body.profileId).toBe(profileId);
        expect(response.body.identifierId).toBe(identifierId);
    });
    test(`If identifier and profile don't exist, they are created and the contact is created using them`, async () => {
        const contact = {
            ...mocks_1.withTaskId,
            rawJson: {
                ...mocks_1.withTaskId.rawJson,
            },
            channel: 'web',
            taskId: `${mocks_1.withTaskId.taskId}-identifier`,
            number: 'identifier',
        };
        const createIdentifierAndProfileSpy = jest.spyOn(profilesService, 'createIdentifierAndProfile');
        // Create contact with conversation media
        const response = await testRequest.post(route).set(testHeaders).send(contact);
        expect(response.status).toBe(200);
        expect(createIdentifierAndProfileSpy).toHaveBeenCalled();
        expect(response.body.profileId).toBeDefined();
        expect(response.body.identifierId).toBeDefined();
    });
    test(`If number is not present in the contact payload, no identifier nor profile is created and they are null in the contact record`, async () => {
        const contact = {
            ...mocks_1.withTaskId,
            rawJson: {
                ...mocks_1.withTaskId.rawJson,
            },
            channel: 'web',
            taskId: `${mocks_1.withTaskId.taskId}-identifier`,
            number: undefined,
        };
        const response = await testRequest.post(route).set(testHeaders).send(contact);
        expect(response.status).toBe(200);
        expect(response.body.profileId).toBeNull();
        expect(response.body.identifierId).toBeNull();
    });
});
