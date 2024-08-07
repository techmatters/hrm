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

import { putS3Object } from '@tech-matters/s3-client';
import { purgeSqsQueue, sendSqsMessage } from '@tech-matters/sqs-client';
import { getStackOutput } from '../../../../cdk/cdkOutput';
import { INPUT_TRANSCRIPT } from '../src/fixtures/sampleTranscripts';
import {
  addConversationMediaToContact,
  createContact,
  createDueRetrieveTranscriptJob,
  waitForCompletedContactJob,
  waitForConversationMedia,
} from '../src/contactDb';
import { MINIMAL_CONTACT } from '../src/fixtures/sampleContacts';
import { S3ContactMediaType } from '@tech-matters/hrm-types/ConversationMedia';
import { waitForExpectedNumberOfSQSMessage } from '../src/sqs';
import { clearAllTables } from '../src/cleanupDb';
import { runContainer } from '../src/docker';
import { newCompletedRetrieveTranscriptMessageBody } from '../src/fixtures/sampleMessages';
import { ContactJobType } from '@tech-matters/types/dist/ContactJob';
import { waitForS3Object } from '../src/s3';

jest.setTimeout(60000);

const completeOutput: any = getStackOutput('contact-complete');
const { dockerQueueUrl: pendingScrubTranscriptJobQueueUrl }: any =
  getStackOutput('scrub-transcript');
const { dockerQueueUrl: completedJobQueueUrl } = completeOutput;

const BUCKET_NAME = 'docs-bucket';
const UNSCRUBBED_TRANSCRIPT_KEY = 'transcripts/test-transcript.txt';
const SCRUBBED_TRANSCRIPT_KEY = 'scrubbed-transcripts/test-transcript.txt';

const verifyConversationMedia = async (
  contactId: number,
  mediaType: S3ContactMediaType.SCRUBBED_TRANSCRIPT | S3ContactMediaType.TRANSCRIPT,
  key: string,
) => {
  const scrubbedTranscriptMedia = await waitForConversationMedia({
    contactId,
    mediaType,
  });
  expect(scrubbedTranscriptMedia).toBeTruthy();

  expect(scrubbedTranscriptMedia.storeTypeSpecificData.type).toBe(mediaType);
  if (scrubbedTranscriptMedia.storeTypeSpecificData.type === mediaType) {
    expect(scrubbedTranscriptMedia?.storeTypeSpecificData.location.bucket).toBe(
      BUCKET_NAME,
    );
    expect(scrubbedTranscriptMedia?.storeTypeSpecificData.location.key).toBe(key);
  }
};

beforeEach(async () => {
  await Promise.all([
    purgeSqsQueue({ queueUrl: completedJobQueueUrl }),
    purgeSqsQueue({ queueUrl: pendingScrubTranscriptJobQueueUrl }),
    clearAllTables(),
  ]);
});

afterAll(async () => {
  await Promise.all([
    purgeSqsQueue({ queueUrl: completedJobQueueUrl }),
    purgeSqsQueue({ queueUrl: pendingScrubTranscriptJobQueueUrl }),
    clearAllTables(),
  ]);
});

test('Retrieve contact job in progress and completed notification retrieved', async () => {
  // Arrange
  // Add unscrubbed transcript to S3 bucket
  await putS3Object({
    bucket: BUCKET_NAME,
    key: UNSCRUBBED_TRANSCRIPT_KEY,
    body: JSON.stringify(INPUT_TRANSCRIPT),
  });
  // Add contact with unscrubbed transcript to Contact table
  const contact = await createContact(MINIMAL_CONTACT);
  const conversationMedia = await addConversationMediaToContact({
    contactId: contact.id,
    storeType: 'S3',
    storeTypeSpecificData: {
      location: {
        bucket: BUCKET_NAME,
        key: UNSCRUBBED_TRANSCRIPT_KEY,
      },
      type: S3ContactMediaType.TRANSCRIPT,
    },
  });
  // Add in progress retrieve transcript job to ContactJobs table
  const job = await createDueRetrieveTranscriptJob(contact, conversationMedia.id);

  // Act
  // Post a 'retrieve transcript complete' message on the completed jobs
  const completedRetrieveTranscriptMessageBody =
    newCompletedRetrieveTranscriptMessageBody(contact, conversationMedia.id, job.id);
  console.log(
    `Posting integration test message to ${completedJobQueueUrl}:`,
    completedRetrieveTranscriptMessageBody,
  );
  await sendSqsMessage({
    queueUrl: completedJobQueueUrl,
    message: completedRetrieveTranscriptMessageBody,
  });
  // Wait for a job to be pending on the scrub-transcript pending queue
  expect(
    await waitForExpectedNumberOfSQSMessage({
      queueUrl: completedJobQueueUrl,
      expectedNumberOfMessages: 0,
    }),
  ).toBe(true);
  expect(
    await waitForExpectedNumberOfSQSMessage({
      queueUrl: pendingScrubTranscriptJobQueueUrl,
      expectedNumberOfMessages: 1,
    }),
  ).toBe(true);
  await verifyConversationMedia(
    contact.id,
    S3ContactMediaType.TRANSCRIPT,
    UNSCRUBBED_TRANSCRIPT_KEY,
  );
  // Run the private AI container
  await runContainer('transcript-scrubber:latest', {
    PENDING_TRANSCRIPT_SQS_QUEUE_URL: pendingScrubTranscriptJobQueueUrl,
    COMPLETED_TRANSCRIPT_SQS_QUEUE_URL: completedJobQueueUrl,
    S3_ENDPOINT: process.env.S3_ENDPOINT.replace('localhost', 'localstack'),
    SQS_ENDPOINT: process.env.SQS_ENDPOINT.replace('localhost', 'localstack'),
  });

  // Assert
  // Check that the original retrieve-transcript is marked as completed in the ContactJobs table
  // Check that the scrub-transcript job is marked as completed in the ContactJobs table
  const retrieveTranscriptJob = await waitForCompletedContactJob({
    contactId: contact.id,
    jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  });
  expect(retrieveTranscriptJob).toBeTruthy();
  expect(retrieveTranscriptJob.completed).toBeTruthy();

  // Check that a scrubbed transcript as written to the S3 bucket
  const scrubbedTranscript = JSON.parse(
    await waitForS3Object({ bucket: BUCKET_NAME, key: SCRUBBED_TRANSCRIPT_KEY }),
  );
  expect(scrubbedTranscript).toBeTruthy();
  // Verify at least some scrubbing has occurred
  expect(scrubbedTranscript.transcript.messages[0].body).toEqual('Incoming webchat contact from [IP_ADDRESS_1]');

  // Both queues should be empty
  expect(
    await waitForExpectedNumberOfSQSMessage({
      queueUrl: completedJobQueueUrl,
      expectedNumberOfMessages: 0,
    }),
  ).toBe(true);
  expect(
    await waitForExpectedNumberOfSQSMessage({
      queueUrl: pendingScrubTranscriptJobQueueUrl,
      expectedNumberOfMessages: 0,
    }),
  ).toBe(true);

  // Check that the scrubbed transcript has been linked as a conversation media item to the contact.
  await verifyConversationMedia(
    contact.id,
    S3ContactMediaType.SCRUBBED_TRANSCRIPT,
    SCRUBBED_TRANSCRIPT_KEY,
  );

  // Check that the scrub-transcript job is marked as completed in the ContactJobs table
  const scrubTranscriptJob = await waitForCompletedContactJob({
    contactId: contact.id,
    jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
  });
  expect(scrubTranscriptJob).toBeTruthy();
  expect(scrubTranscriptJob?.completed).toBeTruthy();
});
