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
const timers_1 = require("timers");
const testing_1 = require("@tech-matters/testing");
const mocks_1 = require("../../mocks");
const dbCleanup_1 = require("../../dbCleanup");
const contactDataAccess_1 = require("@tech-matters/hrm-core/contact/contactDataAccess");
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const ConversationMedia_1 = require("@tech-matters/hrm-types/ConversationMedia");
const types_1 = require("@tech-matters/types");
const contact_job_processor_1 = require("@tech-matters/hrm-core/contact-job/contact-job-processor");
const contact_job_1 = require("@tech-matters/hrm-core/contact-job/contact-job");
const contact_job_data_access_1 = require("@tech-matters/hrm-core/contact-job/contact-job-data-access");
const sqs_client_1 = require("@tech-matters/sqs-client");
const dbConnection_1 = require("../../dbConnection");
const setupServiceTest_1 = require("../../setupServiceTest");
const CONTACT_JOB_COMPLETE_SQS_QUEUE = 'mock-completed-contact-jobs';
const PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE = 'mock-pending-scrub-transcript-jobs';
const SEARCH_INDEX_QUEUE = 'mock-search-index';
const { sqsClient } = (0, setupServiceTest_1.setupServiceTests)(mocks_1.workerSid, [
    CONTACT_JOB_COMPLETE_SQS_QUEUE,
    PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE,
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
            pathPattern: /.*queue-url-scrub-transcript.*/,
            valueGenerator: () => PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE,
        },
        { pathPattern: /.*hrm-search-index.*/, valueGenerator: () => SEARCH_INDEX_QUEUE },
        { pathPattern: /.*enabled.*/, valueGenerator: () => 'true' },
    ]);
    await (0, dbCleanup_1.clearAllTables)();
});
jest.mock('timers', () => {
    return {
        setInterval: jest.fn(),
    };
});
const mockSetInterval = timers_1.setInterval;
const verifyConversationMedia = (contact, expectedType, expectedKey) => {
    const unscrubbedTranscriptMedia = contact.conversationMedia.find(cm => {
        const s3Media = cm;
        return (s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType);
    });
    expect(unscrubbedTranscriptMedia.storeTypeSpecificData.location.bucket).toBe('mock-bucket');
    expect(unscrubbedTranscriptMedia.storeTypeSpecificData.location.key).toBe(expectedKey);
};
let testContactId;
let testContactIdAsNumber;
let singleProcessContactJobsRun;
beforeEach(async () => {
    const testContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
    testContactId = testContact.id;
    testContactIdAsNumber = parseInt(testContact.id);
    await contactApi.addConversationMediaToContact(mocks_1.accountSid, testContactId, [
        {
            storeType: 'S3',
            storeTypeSpecificData: {
                type: ConversationMedia_1.S3ContactMediaType.TRANSCRIPT,
                location: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
            },
        },
    ], mocks_1.ALWAYS_CAN, true);
    mockSetInterval.mockImplementation(callback => {
        singleProcessContactJobsRun = callback;
        return 0;
    });
    (0, contact_job_processor_1.processContactJobs)();
});
describe('Scrub job complete', () => {
    let completedQueueUrl;
    beforeEach(async () => {
        const originalContact = await contactApi.getContactById(mocks_1.accountSid, testContactId, mocks_1.ALWAYS_CAN);
        expect(originalContact.conversationMedia.length).toBe(1);
        verifyConversationMedia(originalContact, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT, 'mock-transcript-path');
        completedQueueUrl = (await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()).QueueUrl;
    });
    test('Receive a completed scrub transcript job for contact with no existing scrubbed transcripts - creates a scrubbed transcript media item', async () => {
        await (0, contact_job_1.createContactJob)()({
            resource: await (0, contactDataAccess_1.getById)(mocks_1.accountSid, testContactIdAsNumber),
            jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
            additionalPayload: {
                originalLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-transcript-path',
                },
            },
        });
        let pendingScrubTranscriptJob;
        await dbConnection_1.db.tx(async (t) => {
            [pendingScrubTranscriptJob] = await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5);
        });
        // Should only be 1 due job
        const message = {
            jobId: pendingScrubTranscriptJob.id,
            jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
            originalLocation: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
            taskId: 'TKx',
            twilioWorkerId: mocks_1.workerSid,
            contactId: testContactIdAsNumber,
            accountSid: mocks_1.accountSid,
            attemptNumber: 0,
            attemptPayload: {
                scrubbedLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-scrubbed-transcript-path',
                },
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
        expect(updatedContact.conversationMedia.length).toBe(2);
        verifyConversationMedia(updatedContact, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT, 'mock-transcript-path');
        verifyConversationMedia(updatedContact, ConversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT, 'mock-scrubbed-transcript-path');
        await dbConnection_1.db.tx(async (t) => {
            expect(await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5)).toHaveLength(0);
        });
    });
    test('Receive a completed scrub transcript job for contact with an existing scrubbed transcripts - updates the scrubbed transcript media item', async () => {
        await contactApi.addConversationMediaToContact(mocks_1.accountSid, testContactId.toString(), [
            {
                storeType: 'S3',
                storeTypeSpecificData: {
                    type: ConversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT,
                    location: { bucket: 'mock-bucket', key: 'mock-old-scrubbed-transcript-path' },
                },
            },
        ], mocks_1.ALWAYS_CAN, true);
        await (0, contact_job_1.createContactJob)()({
            resource: await (0, contactDataAccess_1.getById)(mocks_1.accountSid, testContactIdAsNumber),
            jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
            additionalPayload: {
                originalLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-transcript-path',
                },
            },
        });
        // Should only be 1 due job
        let pendingScrubTranscriptJob;
        await dbConnection_1.db.tx(async (t) => {
            [pendingScrubTranscriptJob] = await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5);
        });
        const message = {
            jobId: pendingScrubTranscriptJob.id,
            jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
            originalLocation: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
            taskId: 'TKx',
            twilioWorkerId: mocks_1.workerSid,
            contactId: testContactIdAsNumber,
            accountSid: mocks_1.accountSid,
            attemptNumber: 0,
            attemptPayload: {
                scrubbedLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-new-scrubbed-transcript-path',
                },
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
        expect(updatedContact.conversationMedia.length).toBe(2);
        verifyConversationMedia(updatedContact, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT, 'mock-transcript-path');
        verifyConversationMedia(updatedContact, ConversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT, 'mock-new-scrubbed-transcript-path');
        await dbConnection_1.db.tx(async (t) => {
            expect(await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5)).toHaveLength(0);
        });
    });
});
describe('Retrieve transcript job complete', () => {
    let pendingScrubQueueUrl;
    let completedQueueUrl;
    beforeEach(async () => {
        completedQueueUrl = (await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()).QueueUrl;
        pendingScrubQueueUrl = (await sqsClient
            .getQueueUrl({ QueueName: PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE })
            .promise()).QueueUrl;
    });
    test('Receive a completed retrieve transcript job and create a scrub job', async () => {
        const originalContact = await contactApi.getContactById(mocks_1.accountSid, testContactId, mocks_1.ALWAYS_CAN);
        await (0, contact_job_1.createContactJob)()({
            resource: await (0, contactDataAccess_1.getById)(mocks_1.accountSid, testContactIdAsNumber),
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            additionalPayload: {
                originalLocation: {
                    bucket: 'mock-bucket',
                    key: 'mock-transcript-path',
                },
            },
        });
        let pendingRetrieveJobs;
        await dbConnection_1.db.tx(async (t) => {
            [pendingRetrieveJobs] = await (0, contact_job_data_access_1.pullDueContactJobs)(t, new Date(), 5);
        });
        const message = {
            jobId: pendingRetrieveJobs.id,
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            taskId: 'TKx',
            twilioWorkerId: mocks_1.workerSid,
            contactId: testContactIdAsNumber,
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
        const { Messages: messages } = await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl: pendingScrubQueueUrl,
        });
        console.log('messages is here', messages);
        expect(messages).toHaveLength(1);
        const pendingScrubMessage = JSON.parse(messages[0].Body);
        console.log('pendingScrubMessage', pendingScrubMessage);
        expect(pendingScrubMessage.contactId).toBe(parseInt(testContactId));
        expect(pendingScrubMessage.jobType).toBe(types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT);
        expect(pendingScrubMessage.originalLocation).toStrictEqual({
            bucket: 'mock-bucket',
            key: 'mock-transcript-path',
        });
    });
});
