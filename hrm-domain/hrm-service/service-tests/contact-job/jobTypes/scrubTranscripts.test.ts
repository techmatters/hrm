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
import {
  ContactJob,
  pullDueContactJobs,
} from '@tech-matters/hrm-core/contact-job/contact-job-data-access';
import { receiveSqsMessage } from '@tech-matters/sqs-client';
import { db } from '../../dbConnection';

const CONTACT_JOB_COMPLETE_SQS_QUEUE = 'mock-completed-contact-jobs';
const PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE = 'mock-pending-scrub-transcript-jobs';
const SEARCH_INDEX_QUEUE = 'mock-search-index';

useOpenRules();
const server = getServer();

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  const mockttp = await mockingProxy.mockttpServer();

  await mockSsmParameters(mockttp, [
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
  await clearAllTables();
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
  SEARCH_INDEX_QUEUE,
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

let testContactId: number;
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
  mockSetInterval.mockImplementation(callback => {
    singleProcessContactJobsRun = callback as () => Promise<void>;
    return 0 as any;
  });
  processContactJobs();
});

describe('Scrub job complete', () => {
  let completedQueueUrl: string;

  beforeEach(async () => {
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

    let pendingScrubTranscriptJob: ContactJob;
    await db.tx(async t => {
      [pendingScrubTranscriptJob] = await pullDueContactJobs(t, new Date(), 5);
    });
    // Should only be 1 due job

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

    await db.tx(async t => {
      expect(await pullDueContactJobs(t, new Date(), 5)).toHaveLength(0);
    });
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
    let pendingScrubTranscriptJob: ContactJob;
    await db.tx(async t => {
      [pendingScrubTranscriptJob] = await pullDueContactJobs(t, new Date(), 5);
    });

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

    await db.tx(async t => {
      expect(await pullDueContactJobs(t, new Date(), 5)).toHaveLength(0);
    });
  });
});

describe('Retrieve transcript job complete', () => {
  let pendingScrubQueueUrl: string;
  let completedQueueUrl: string;

  beforeEach(async () => {
    completedQueueUrl = (
      await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()
    ).QueueUrl;
    pendingScrubQueueUrl = (
      await sqsClient
        .getQueueUrl({ QueueName: PENDING_SCRUB_TRANSCRIPT_JOBS_QUEUE })
        .promise()
    ).QueueUrl;
  });

  test('Receive a completed retrieve transcript job and create a scrub job', async () => {
    const originalContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
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

    let pendingRetrieveJobs: ContactJob;
    await db.tx(async t => {
      [pendingRetrieveJobs] = await pullDueContactJobs(t, new Date(), 5);
    });

    const message: CompletedRetrieveContactTranscript = {
      jobId: pendingRetrieveJobs.id,
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      taskId: 'TKx',
      twilioWorkerId: workerSid,
      contactId: testContactId,
      accountSid,
      attemptNumber: 0,
      serviceSid: 'string',
      channelSid: 'string',
      filePath: 'string',
      conversationMediaId: originalContact.conversationMedia[0].id,
      attemptPayload: {
        bucket: 'mock-bucket',
        key: 'mock-transcript-path',
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

    expect(updatedContact.conversationMedia?.length).toBe(1);
    verifyConversationMedia(
      updatedContact,
      S3ContactMediaType.TRANSCRIPT,
      'mock-transcript-path',
    );

    const { Messages: messages } = await receiveSqsMessage({
      queueUrl: pendingScrubQueueUrl,
    });

    console.log('messages is here', messages);

    expect(messages).toHaveLength(1);
    const pendingScrubMessage = JSON.parse(messages[0].Body);
    console.log('pendingScrubMessage', pendingScrubMessage);
    expect(pendingScrubMessage.contactId).toBe(testContactId);
    expect(pendingScrubMessage.jobType).toBe(ContactJobType.SCRUB_CONTACT_TRANSCRIPT);
    expect(pendingScrubMessage.originalLocation).toStrictEqual({
      bucket: 'mock-bucket',
      key: 'mock-transcript-path',
    });
  });
});
