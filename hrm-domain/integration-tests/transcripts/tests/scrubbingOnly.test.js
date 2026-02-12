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
Object.defineProperty(exports, "__esModule", { value: true });
const s3_client_1 = require("@tech-matters/s3-client");
const sqs_client_1 = require("@tech-matters/sqs-client");
const cdkOutput_1 = require("../../../../cdk/cdkOutput");
const sampleTranscripts_1 = require("../src/fixtures/sampleTranscripts");
const contactDb_1 = require("../src/contactDb");
const sampleContacts_1 = require("../src/fixtures/sampleContacts");
const ConversationMedia_1 = require("@tech-matters/hrm-types/ConversationMedia");
const sqs_1 = require("../src/sqs");
const cleanupDb_1 = require("../src/cleanupDb");
const docker_1 = require("../src/docker");
const sampleMessages_1 = require("../src/fixtures/sampleMessages");
const ContactJob_1 = require("@tech-matters/types/ContactJob");
const s3_1 = require("../src/s3");
const sampleConfig_1 = require("../src/fixtures/sampleConfig");
const ssm_1 = require("../src/ssm");
jest.setTimeout(60000);
const completeOutput = (0, cdkOutput_1.getStackOutput)('contact-complete');
const { dockerQueueUrl: pendingScrubTranscriptJobQueueUrl } = (0, cdkOutput_1.getStackOutput)('scrub-transcript');
const { dockerQueueUrl: completedJobQueueUrl } = completeOutput;
const BUCKET_NAME = 'docs-bucket';
const UNSCRUBBED_TRANSCRIPT_KEY = 'transcripts/test-transcript.txt';
const SCRUBBED_TRANSCRIPT_KEY = 'scrubbed-transcripts/test-transcript.txt';
const verifyConversationMedia = async (contactId, mediaType, key) => {
    const scrubbedTranscriptMedia = await (0, contactDb_1.waitForConversationMedia)({
        contactId,
        mediaType,
    });
    expect(scrubbedTranscriptMedia).toBeTruthy();
    expect(scrubbedTranscriptMedia.storeTypeSpecificData.type).toBe(mediaType);
    if (scrubbedTranscriptMedia.storeTypeSpecificData.type === mediaType) {
        expect(scrubbedTranscriptMedia?.storeTypeSpecificData.location.bucket).toBe(BUCKET_NAME);
        expect(scrubbedTranscriptMedia?.storeTypeSpecificData.location.key).toBe(key);
    }
};
beforeEach(async () => {
    await Promise.all([
        (0, sqs_client_1.purgeSqsQueue)({ queueUrl: completedJobQueueUrl }),
        (0, sqs_client_1.purgeSqsQueue)({ queueUrl: pendingScrubTranscriptJobQueueUrl }),
        (0, cleanupDb_1.clearAllTables)(),
    ]);
});
afterAll(async () => {
    await Promise.all([
        (0, sqs_client_1.purgeSqsQueue)({ queueUrl: completedJobQueueUrl }),
        (0, sqs_client_1.purgeSqsQueue)({ queueUrl: pendingScrubTranscriptJobQueueUrl }),
        (0, cleanupDb_1.clearAllTables)(),
        (0, ssm_1.deleteParameter)(`${sampleConfig_1.ACCOUNT_SID}/jobs/contact/scrub-transcript/enabled`),
    ]);
});
test('Retrieve contact job in progress and completed notification retrieved', async () => {
    // Arrange
    // Add unscrubbed transcript to S3 bucket
    await (0, s3_client_1.putS3Object)({
        bucket: BUCKET_NAME,
        key: UNSCRUBBED_TRANSCRIPT_KEY,
        body: JSON.stringify(sampleTranscripts_1.INPUT_TRANSCRIPT),
    });
    await (0, ssm_1.putParameter)(`${sampleConfig_1.ACCOUNT_SID}/jobs/contact/scrub-transcript/enabled`, 'true');
    // Add contact with unscrubbed transcript to Contact table
    const contact = await (0, contactDb_1.createContact)(sampleContacts_1.MINIMAL_CONTACT);
    const conversationMedia = await (0, contactDb_1.addConversationMediaToContact)({
        contactId: contact.id,
        storeType: 'S3',
        storeTypeSpecificData: {
            location: {
                bucket: BUCKET_NAME,
                key: UNSCRUBBED_TRANSCRIPT_KEY,
            },
            type: ConversationMedia_1.S3ContactMediaType.TRANSCRIPT,
        },
    });
    // Add in progress retrieve transcript job to ContactJobs table
    const job = await (0, contactDb_1.createDueRetrieveTranscriptJob)(contact, conversationMedia.id);
    // Act
    // Post a 'retrieve transcript complete' message on the completed jobs
    const completedRetrieveTranscriptMessageBody = (0, sampleMessages_1.newCompletedRetrieveTranscriptMessageBody)(contact, conversationMedia.id, job.id);
    console.log(`Posting integration test message to ${completedJobQueueUrl}:`, completedRetrieveTranscriptMessageBody);
    await (0, sqs_client_1.sendSqsMessage)({
        queueUrl: completedJobQueueUrl,
        message: completedRetrieveTranscriptMessageBody,
    });
    // Wait for a job to be pending on the scrub-transcript pending queue
    expect(await (0, sqs_1.waitForExpectedNumberOfSQSMessage)({
        queueUrl: completedJobQueueUrl,
        expectedNumberOfMessages: 0,
    })).toBe(true);
    expect(await (0, sqs_1.waitForExpectedNumberOfSQSMessage)({
        queueUrl: pendingScrubTranscriptJobQueueUrl,
        expectedNumberOfMessages: 1,
    })).toBe(true);
    await verifyConversationMedia(contact.id, ConversationMedia_1.S3ContactMediaType.TRANSCRIPT, UNSCRUBBED_TRANSCRIPT_KEY);
    // Run the private AI container
    await (0, docker_1.runContainer)('transcript-scrubber:latest', {
        PAI_DISABLE_RAM_CHECK: 'true',
        PENDING_TRANSCRIPT_SQS_QUEUE_URL: pendingScrubTranscriptJobQueueUrl,
        COMPLETED_TRANSCRIPT_SQS_QUEUE_URL: completedJobQueueUrl,
        S3_ENDPOINT: process.env.S3_ENDPOINT.replace('localhost', 'localstack'),
        SQS_ENDPOINT: process.env.SQS_ENDPOINT.replace('localhost', 'localstack'),
    }, {
        maxMemoryMb: 4096,
    });
    // Assert
    // Check that the original retrieve-transcript is marked as completed in the ContactJobs table
    // Check that the scrub-transcript job is marked as completed in the ContactJobs table
    const retrieveTranscriptJob = await (0, contactDb_1.waitForCompletedContactJob)({
        contactId: contact.id,
        jobType: ContactJob_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    });
    expect(retrieveTranscriptJob).toBeTruthy();
    expect(retrieveTranscriptJob.completed).toBeTruthy();
    // Check that a scrubbed transcript as written to the S3 bucket
    const scrubbedTranscript = JSON.parse(await (0, s3_1.waitForS3Object)({ bucket: BUCKET_NAME, key: SCRUBBED_TRANSCRIPT_KEY }));
    expect(scrubbedTranscript).toBeTruthy();
    // Verify at least some scrubbing has occurred
    expect(scrubbedTranscript.transcript.messages[0].body).toEqual('Incoming webchat contact from [IP_ADDRESS_1]');
    // Both queues should be empty
    expect(await (0, sqs_1.waitForExpectedNumberOfSQSMessage)({
        queueUrl: completedJobQueueUrl,
        expectedNumberOfMessages: 0,
    })).toBe(true);
    expect(await (0, sqs_1.waitForExpectedNumberOfSQSMessage)({
        queueUrl: pendingScrubTranscriptJobQueueUrl,
        expectedNumberOfMessages: 0,
    })).toBe(true);
    // Check that the scrubbed transcript has been linked as a conversation media item to the contact.
    await verifyConversationMedia(contact.id, ConversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT, SCRUBBED_TRANSCRIPT_KEY);
    // Check that the scrub-transcript job is marked as completed in the ContactJobs table
    const scrubTranscriptJob = await (0, contactDb_1.waitForCompletedContactJob)({
        contactId: contact.id,
        jobType: ContactJob_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
    });
    expect(scrubTranscriptJob).toBeTruthy();
    expect(scrubTranscriptJob?.completed).toBeTruthy();
});
