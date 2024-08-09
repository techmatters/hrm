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

import { setInterval } from 'timers';
import { getServer, useOpenRules } from '../../server';
import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../../mocks';
import { clearAllTables } from '../../dbCleanup';
import { setupTestQueues } from '../../sqs';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import {
  S3ContactMediaType,
  S3StoredConversationMedia,
} from '@tech-matters/hrm-types/ConversationMedia';
import {
  CompletedRetrieveContactTranscript,
  CompletedScrubContactTranscript,
  ContactJobAttemptResult,
  ContactJobType,
} from '@tech-matters/types';
import { processContactJobs } from '@tech-matters/hrm-core/contact-job/contact-job-processor';
import { createContactJob } from '@tech-matters/hrm-core/contact-job/contact-job';
import { pullDueContactJobs } from '@tech-matters/hrm-core/contact-job/contact-job-data-access';

const CONTACT_JOB_COMPLETE_SQS_QUEUE = 'mock-completed-contact-jobs';
const PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE = 'mock-pending-scrub-transcript-jobs';

useOpenRules();
const server = getServer();

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  const mockttp = await mockingProxy.mockttpServer();

  await mockSsmParameters(mockttp, [
    { pathPattern: /.*/, valueGenerator: () => CONTACT_JOB_COMPLETE_SQS_QUEUE },
  ]);
  await mockSsmParameters(mockttp, [
    { pathPattern: /.*/, valueGenerator: () => PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE },
  ]);
});

afterAll(async () => {
  await mockingProxy.stop();
  server.close();
});

afterEach(clearAllTables);

jest.mock('timers', () => {
  return {
    setInterval: jest.fn(),
  };
});

const mockSetInterval = setInterval as jest.MockedFunction<typeof setInterval>;

const { sqsClient } = setupTestQueues([
  CONTACT_JOB_COMPLETE_SQS_QUEUE,
  PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE,
]);

const verifyConversationMedia = (
  contact: contactApi.Contact,
  expectedType: S3ContactMediaType,
  expectedKey: string,
) => {
  const unscrubbedTranscriptMedia: S3StoredConversationMedia =
    contact.conversationMedia.find(cm => {
      const s3Media = cm as S3StoredConversationMedia;
      return (
        s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType
      );
    }) as S3StoredConversationMedia;

  expect(unscrubbedTranscriptMedia.storeTypeSpecificData.location.bucket).toBe(
    'mock-bucket',
  );
  expect(unscrubbedTranscriptMedia.storeTypeSpecificData.location.key).toBe(expectedKey);
};

describe('Scrub job complete', () => {
  let testContactId: number;
  let completedQueueUrl: string;
  let pendingScrubQueueUrl: string;
  let singleProcessContactJobsRun: () => Promise<void>;

  beforeEach(async () => {
    const testContact = await contactApi.createContact(
      accountSid,
      workerSid,
      contact1,
      ALWAYS_CAN,
      true,
    );
    testContactId = testContact.id;
    await contactApi.addConversationMediaToContact(
      accountSid,
      testContact.id.toString(),
      [
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
            location: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
          },
        },
      ],
      ALWAYS_CAN,
      true,
    );

    const originalContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
    );

    expect(originalContact.conversationMedia.length).toBe(1);
    verifyConversationMedia(
      originalContact,
      S3ContactMediaType.TRANSCRIPT,
      'mock-transcript-path',
    );
    completedQueueUrl = (
      await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()
    ).QueueUrl;
    pendingScrubQueueUrl = (
      await sqsClient
        .getQueueUrl({ QueueName: PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE })
        .promise()
    ).QueueUrl;
    mockSetInterval.mockImplementation(callback => {
      singleProcessContactJobsRun = callback as () => Promise<void>;
      return 0 as any;
    });
    processContactJobs();
  });

  test('Receive a completed scrub transcript job for contact with no existing scrubbed transcripts - creates a scrubbed transcript media item', async () => {
    await createContactJob()({
      resource: await contactApi.getContactById(accountSid, testContactId, ALWAYS_CAN),
      jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
      additionalPayload: {
        originalLocation: {
          bucket: 'mock-bucket',
          key: 'mock-transcript-path',
        },
      },
    });

    // Should only be 1 due job
    const [pendingScrubTranscriptJob] = await pullDueContactJobs(new Date(), 5);

    const message: CompletedScrubContactTranscript = {
      jobId: pendingScrubTranscriptJob.id,
      jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
      originalLocation: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
      taskId: 'TKx',
      twilioWorkerId: workerSid,
      contactId: testContactId,
      accountSid,
      attemptNumber: 0,
      attemptPayload: {
        scrubbedLocation: {
          bucket: 'mock-bucket',
          key: 'mock-scrubbed-transcript-path',
        },
      },
      attemptResult: ContactJobAttemptResult.SUCCESS,
    };

    await sqsClient
      .sendMessage({
        QueueUrl: completedQueueUrl,
        MessageBody: JSON.stringify(message),
      })
      .promise();

    await singleProcessContactJobsRun();

    const updatedContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
    );

    expect(updatedContact.conversationMedia.length).toBe(2);
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.TRANSCRIPT,
      'mock-transcript-path',
    );
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.SCRUBBED_TRANSCRIPT,
      'mock-scrubbed-transcript-path',
    );
    expect(await pullDueContactJobs(new Date(), 5)).toHaveLength(0);
  });

  test('Receive a completed scrub transcript job for contact with an existing scrubbed transcripts - updates the scrubbed transcript media item', async () => {
    await contactApi.addConversationMediaToContact(
      accountSid,
      testContactId.toString(),
      [
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.SCRUBBED_TRANSCRIPT,
            location: { bucket: 'mock-bucket', key: 'mock-old-scrubbed-transcript-path' },
          },
        },
      ],
      ALWAYS_CAN,
      true,
    );

    await createContactJob()({
      resource: await contactApi.getContactById(accountSid, testContactId, ALWAYS_CAN),
      jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
      additionalPayload: {
        originalLocation: {
          bucket: 'mock-bucket',
          key: 'mock-transcript-path',
        },
      },
    });

    // Should only be 1 due job
    const [pendingScrubTranscriptJob] = await pullDueContactJobs(new Date(), 5);

    const message: CompletedScrubContactTranscript = {
      jobId: pendingScrubTranscriptJob.id,
      jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
      originalLocation: { bucket: 'mock-bucket', key: 'mock-transcript-path' },
      taskId: 'TKx',
      twilioWorkerId: workerSid,
      contactId: testContactId,
      accountSid,
      attemptNumber: 0,
      attemptPayload: {
        scrubbedLocation: {
          bucket: 'mock-bucket',
          key: 'mock-new-scrubbed-transcript-path',
        },
      },
      attemptResult: ContactJobAttemptResult.SUCCESS,
    };

    await sqsClient
      .sendMessage({
        QueueUrl: completedQueueUrl,
        MessageBody: JSON.stringify(message),
      })
      .promise();

    await singleProcessContactJobsRun();

    const updatedContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
    );

    expect(updatedContact.conversationMedia.length).toBe(2);
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.TRANSCRIPT,
      'mock-transcript-path',
    );
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.SCRUBBED_TRANSCRIPT,
      'mock-new-scrubbed-transcript-path',
    );
    expect(await pullDueContactJobs(new Date(), 5)).toHaveLength(0);
  });

  test('Receive a completed retrieve transcript job and create a scrub job', async () => {
    await contactApi.addConversationMediaToContact(
      accountSid,
      testContactId.toString(),
      [
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.SCRUBBED_TRANSCRIPT,
            location: { bucket: 'mock-bucket', key: 'mock-old-scrubbed-transcript-path' },
          },
        },
      ],
      ALWAYS_CAN,
      true,
    );

    await createContactJob()({
      resource: await contactApi.getContactById(accountSid, testContactId, ALWAYS_CAN),
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      additionalPayload: {
        originalLocation: {
          bucket: 'mock-bucket',
          key: 'mock-transcript-path',
        },
      },
    });

    const [pendingScrubJobs] = await pullDueContactJobs(new Date(), 5);

    const message: CompletedRetrieveContactTranscript = {
      jobId: pendingScrubJobs.id,
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      taskId: 'TKx',
      twilioWorkerId: workerSid,
      contactId: testContactId,
      accountSid,
      attemptNumber: 0,
      serviceSid: 'string',
      channelSid: 'string',
      filePath: 'string',
      conversationMediaId: 5,
      attemptPayload: {
        bucket: 'mock-bucket',
        key: 'mock-retrieved-transcript-path',
      },
      attemptResult: ContactJobAttemptResult.SUCCESS,
    };

    await sqsClient
      .sendMessage({
        QueueUrl: completedQueueUrl,
        MessageBody: JSON.stringify(message),
      })
      .promise();

    await singleProcessContactJobsRun();

    const updatedContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
    );

    expect(updatedContact.conversationMedia?.length).toBe(2);
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.TRANSCRIPT,
      (updatedContact.conversationMedia[0].storeTypeSpecificData as any).location.key,
    );

    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.SCRUBBED_TRANSCRIPT,
      (updatedContact.conversationMedia[1].storeTypeSpecificData as any).location.key,
    );

    const messages = await sqsClient
      .receiveMessage({
        QueueUrl: pendingScrubQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
      })
      .promise();

    console.log('messages is here', messages);

    expect(messages.Messages).toHaveLength(messages.Messages.length);
    const pendingScrubMessage = JSON.parse(messages.Messages[0].Body);
    expect(pendingScrubMessage.contact.id).toBe(testContactId);

    expect(pendingScrubJobs).toBeDefined();
    expect(pendingScrubJobs.jobType).toBe(ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT);
  });
});
