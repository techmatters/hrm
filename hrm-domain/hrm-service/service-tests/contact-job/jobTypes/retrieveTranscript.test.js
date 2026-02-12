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
const timers_1 = require("timers");
const testing_1 = require("@tech-matters/testing");
const mocks_1 = require("../../mocks");
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const ConversationMedia_1 = require("@tech-matters/hrm-types/ConversationMedia");
const types_1 = require("@tech-matters/types");
const contact_job_processor_1 = require("@tech-matters/hrm-core/contact-job/contact-job-processor");
const contact_job_1 = require("@tech-matters/hrm-core/contact-job/contact-job");
const contact_job_data_access_1 = require("@tech-matters/hrm-core/contact-job/contact-job-data-access");
const sqs_client_1 = require("@tech-matters/sqs-client");
const dbConnection_1 = require("../../dbConnection");
const setupServiceTest_1 = require("../../setupServiceTest");
const subDays_1 = __importDefault(require("date-fns/subDays"));
const contactDataAccess_1 = require("@tech-matters/hrm-core/contact/contactDataAccess");
const CONTACT_JOB_COMPLETE_SQS_QUEUE = 'mock-completed-contact-jobs';
const PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE = 'mock-pending-retrieve-transcript-jobs';
const SEARCH_INDEX_QUEUE = 'mock-search-index';
const { sqsClient } = (0, setupServiceTest_1.setupServiceTests)(mocks_1.workerSid, [
    CONTACT_JOB_COMPLETE_SQS_QUEUE,
    PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE,
    SEARCH_INDEX_QUEUE,
]);
beforeAll(async () => {
    const mockttp = await testing_1.mockingProxy.mockttpServer();
    await (0, testing_1.mockSsmParameters)(mockttp, [
        {
            pathPattern: /.*queue-url-complete.*/,
            valueGenerator: () => CONTACT_JOB_COMPLETE_SQS_QUEUE,
        },
        {
            pathPattern: /.*queue-url-retrieve-transcript.*/,
            valueGenerator: () => PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE,
        },
        { pathPattern: /.*hrm-search-index.*/, valueGenerator: () => SEARCH_INDEX_QUEUE },
        { pathPattern: /.*enabled.*/, valueGenerator: () => 'true' },
    ]);
});
jest.mock('timers', () => {
    return {
        setInterval: jest.fn(),
    };
});
const mockSetInterval = timers_1.setInterval;
const verifyPendingConversationMedia = (contact, expectedType) => {
    const transcriptMedia = contact.conversationMedia.find(cm => {
        const s3Media = cm;
        return (s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType);
    });
    expect(transcriptMedia.storeTypeSpecificData.location).not.toBeDefined();
};
const verifyConversationMedia = (contact, expectedType, expectedKey) => {
    const transcriptMedia = contact.conversationMedia.find(cm => {
        const s3Media = cm;
        return (s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType);
    });
    expect(transcriptMedia.storeTypeSpecificData.location.bucket).toBe('mock-bucket');
    expect(transcriptMedia.storeTypeSpecificData.location.key).toBe(expectedKey);
};
let testContactId;
let singleProcessContactJobsRun;
beforeEach(async () => {
    const testContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
    testContactId = testContact.id;
    await contactApi.addConversationMediaToContact(mocks_1.accountSid, testContact.id, [
        {
            storeType: 'S3',
            storeTypeSpecificData: {
                type: ConversationMedia_1.S3ContactMediaType.TRANSCRIPT,
            },
        },
    ], mocks_1.ALWAYS_CAN, true);
    mockSetInterval.mockImplementation(callback => {
        singleProcessContactJobsRun = callback;
        return 0;
    });
    (0, contact_job_processor_1.processContactJobs)();
});
describe('Contact created', () => {
    let pendingRetrieveQueueUrl;
    beforeEach(async () => {
        const originalContact = await contactApi.getContactById(mocks_1.accountSid, testContactId, mocks_1.ALWAYS_CAN);
        expect(originalContact.conversationMedia.length).toBe(1);
        verifyPendingConversationMedia(originalContact, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT);
        pendingRetrieveQueueUrl = (await sqsClient
            .getQueueUrl({ QueueName: PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE })
            .promise()).QueueUrl;
    });
    test('Creates a contact job in the ContactJobs table', async () => {
        let pendingRetrieveTranscriptJob = {};
        await dbConnection_1.db.tx(async (t) => {
            [pendingRetrieveTranscriptJob] = await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5);
        });
        expect(pendingRetrieveTranscriptJob).toBeDefined();
        expect(pendingRetrieveTranscriptJob.jobType).toBe(types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
        expect(pendingRetrieveTranscriptJob.resource).toBeDefined();
        expect(pendingRetrieveTranscriptJob.resource.id.toString()).toBe(testContactId);
        expect(pendingRetrieveTranscriptJob.resource.accountSid).toBe(mocks_1.accountSid);
        expect(pendingRetrieveTranscriptJob.additionalPayload).toBeDefined();
    });
    test('Publishes a retrieve transcript job to the queue', async () => {
        await singleProcessContactJobsRun();
        const messageResponse = await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl: pendingRetrieveQueueUrl,
        });
        const { Messages: messages } = messageResponse;
        expect(messages).toHaveLength(1);
        const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
        console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
        expect(pendingRetrieveTranscriptJob.contactId).toBe(parseInt(testContactId));
        expect(pendingRetrieveTranscriptJob.jobType).toBe(types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
        const secondResponse = await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl: pendingRetrieveQueueUrl,
        });
        expect(secondResponse.Messages).not.toBeDefined();
    });
    test('Will not republish if already sent', async () => {
        await singleProcessContactJobsRun();
        await singleProcessContactJobsRun();
        await singleProcessContactJobsRun();
        const messageResponse = await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl: pendingRetrieveQueueUrl,
        });
        const { Messages: messages } = messageResponse;
        expect(messages).toHaveLength(1);
        const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
        console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
        expect(pendingRetrieveTranscriptJob.contactId).toBe(parseInt(testContactId));
        expect(pendingRetrieveTranscriptJob.jobType).toBe(types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
        const secondResponse = await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl: pendingRetrieveQueueUrl,
        });
        expect(secondResponse.Messages).not.toBeDefined();
    });
    test('Will republish if previous attempt expires', async () => {
        await singleProcessContactJobsRun();
        // Set last attempt a day in the past so the job is due
        await dbConnection_1.db.none('UPDATE "ContactJobs" SET "lastAttempt" = $<lastAttempt> WHERE "contactId" = $<testContactId>', { lastAttempt: (0, subDays_1.default)(new Date(), 1), testContactId });
        await singleProcessContactJobsRun();
        for (let i = 0; i < 2; i += 1) {
            const messageResponse = await (0, sqs_client_1.receiveSqsMessage)({
                queueUrl: pendingRetrieveQueueUrl,
            });
            const { Messages: messages } = messageResponse;
            expect(messages).toHaveLength(1);
            const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
            console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
            expect(pendingRetrieveTranscriptJob.contactId).toBe(parseInt(testContactId));
            expect(pendingRetrieveTranscriptJob.jobType).toBe(types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
        }
    });
});
describe('Retrieve transcript job complete', () => {
    let completedQueueUrl;
    beforeEach(async () => {
        completedQueueUrl = (await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()).QueueUrl;
    });
    test('Receive a completed retrieve transcript job and create a scrub job', async () => {
        const originalContact = await (0, contactDataAccess_1.getById)(mocks_1.accountSid, parseInt(testContactId));
        await (0, contact_job_1.createContactJob)()({
            resource: await (0, contactDataAccess_1.getById)(mocks_1.accountSid, parseInt(testContactId)),
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            additionalPayload: {
                originalLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-transcript-path',
                },
            },
        });
        let pendingRetrieveJobs = {};
        await dbConnection_1.db.tx(async (t) => {
            [pendingRetrieveJobs] = await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5);
        });
        const message = {
            jobId: pendingRetrieveJobs.id,
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            taskId: 'TKx',
            twilioWorkerId: mocks_1.workerSid,
            contactId: parseInt(testContactId),
            accountSid: mocks_1.accountSid,
            attemptNumber: 0,
            serviceSid: 'string',
            channelSid: 'string',
            filePath: 'string',
            conversationMediaId: originalContact.conversationMedia[0].id,
            attemptPayload: {
                bucket: 'mock-bucket',
                key: 'mock-transcript-path',
            },
            attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
        };
        await sqsClient
            .sendMessage({
            QueueUrl: completedQueueUrl,
            MessageBody: JSON.stringify(message),
        })
            .promise();
        await singleProcessContactJobsRun();
        const updatedContact = await contactApi.getContactById(mocks_1.accountSid, testContactId, mocks_1.ALWAYS_CAN);
        expect(updatedContact.conversationMedia?.length).toBe(1);
        verifyConversationMedia(updatedContact, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT, 'mock-transcript-path');
    });
});
