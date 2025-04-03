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
import { mockingProxy, mockSsmParameters } from '@tech-matters/testing';
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../../mocks';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import {
  S3ContactMediaType,
  S3StoredConversationMedia,
} from '@tech-matters/hrm-types/ConversationMedia';
import {
  CompletedRetrieveContactTranscript,
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
import { setupServiceTests } from '../../setupServiceTest';
import subDays from 'date-fns/subDays';

const CONTACT_JOB_COMPLETE_SQS_QUEUE = 'mock-completed-contact-jobs';
const PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE = 'mock-pending-retrieve-transcript-jobs';
const SEARCH_INDEX_QUEUE = 'mock-search-index';

const { sqsClient } = setupServiceTests(workerSid, [
  CONTACT_JOB_COMPLETE_SQS_QUEUE,
  PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE,
  SEARCH_INDEX_QUEUE,
]);

beforeAll(async () => {
  const mockttp = await mockingProxy.mockttpServer();

  await mockSsmParameters(mockttp, [
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

const mockSetInterval = setInterval as jest.MockedFunction<typeof setInterval>;

const verifyPendingConversationMedia = (
  contact: contactApi.Contact,
  expectedType: S3ContactMediaType,
) => {
  const transcriptMedia: S3StoredConversationMedia = contact.conversationMedia.find(
    cm => {
      const s3Media = cm as S3StoredConversationMedia;
      return (
        s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType
      );
    },
  ) as S3StoredConversationMedia;

  expect(transcriptMedia.storeTypeSpecificData.location).not.toBeDefined();
};
const verifyConversationMedia = (
  contact: contactApi.Contact,
  expectedType: S3ContactMediaType,
  expectedKey: string,
) => {
  const transcriptMedia: S3StoredConversationMedia = contact.conversationMedia.find(
    cm => {
      const s3Media = cm as S3StoredConversationMedia;
      return (
        s3Media.storeType === 'S3' && s3Media.storeTypeSpecificData.type === expectedType
      );
    },
  ) as S3StoredConversationMedia;

  expect(transcriptMedia.storeTypeSpecificData.location.bucket).toBe('mock-bucket');
  expect(transcriptMedia.storeTypeSpecificData.location.key).toBe(expectedKey);
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

describe('Contact created', () => {
  let pendingRetrieveQueueUrl: string;

  beforeEach(async () => {
    const originalContact = await contactApi.getContactById(
      accountSid,
      testContactId,
      ALWAYS_CAN,
    );

    expect(originalContact.conversationMedia.length).toBe(1);
    verifyPendingConversationMedia(originalContact, S3ContactMediaType.TRANSCRIPT);
    pendingRetrieveQueueUrl = (
      await sqsClient
        .getQueueUrl({ QueueName: PENDING_RETRIEVE_TRANSCRIPT_JOBS_QUEUE })
        .promise()
    ).QueueUrl;
  });

  test('Creates a contact job in the ContactJobs table', async () => {
    let pendingRetrieveTranscriptJob: ContactJob = {} as ContactJob;
    await db.tx(async t => {
      [pendingRetrieveTranscriptJob] = await pullDueContactJobs(t, new Date(), 5);
    });

    expect(pendingRetrieveTranscriptJob).toBeDefined();
    expect(pendingRetrieveTranscriptJob.jobType).toBe(
      ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    );
    expect(pendingRetrieveTranscriptJob.resource).toBeDefined();
    expect(pendingRetrieveTranscriptJob.resource.id).toBe(testContactId);
    expect(pendingRetrieveTranscriptJob.resource.accountSid).toBe(accountSid);
    expect(pendingRetrieveTranscriptJob.additionalPayload).toBeDefined();
  });

  test('Publishes a retrieve transcript job to the queue', async () => {
    await singleProcessContactJobsRun();
    const messageResponse = await receiveSqsMessage({
      queueUrl: pendingRetrieveQueueUrl,
    });
    const { Messages: messages } = messageResponse;
    expect(messages).toHaveLength(1);
    const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
    console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
    expect(pendingRetrieveTranscriptJob.contactId).toBe(testContactId);
    expect(pendingRetrieveTranscriptJob.jobType).toBe(
      ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    );
    const secondResponse = await receiveSqsMessage({
      queueUrl: pendingRetrieveQueueUrl,
    });
    expect(secondResponse.Messages).not.toBeDefined();
  });

  test('Will not republish if already sent', async () => {
    await singleProcessContactJobsRun();
    await singleProcessContactJobsRun();
    await singleProcessContactJobsRun();
    const messageResponse = await receiveSqsMessage({
      queueUrl: pendingRetrieveQueueUrl,
    });
    const { Messages: messages } = messageResponse;
    expect(messages).toHaveLength(1);
    const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
    console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
    expect(pendingRetrieveTranscriptJob.contactId).toBe(testContactId);
    expect(pendingRetrieveTranscriptJob.jobType).toBe(
      ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    );
    const secondResponse = await receiveSqsMessage({
      queueUrl: pendingRetrieveQueueUrl,
    });
    expect(secondResponse.Messages).not.toBeDefined();
  });
  test('Will republish if previous attempt expires', async () => {
    await singleProcessContactJobsRun();
    // Set last attempt a day in the past so the job is due
    await db.none(
      'UPDATE "ContactJobs" SET "lastAttempt" = $<lastAttempt> WHERE "contactId" = $<testContactId>',
      { lastAttempt: subDays(new Date(), 1), testContactId },
    );
    await singleProcessContactJobsRun();

    for (let i = 0; i < 2; i += 1) {
      const messageResponse = await receiveSqsMessage({
        queueUrl: pendingRetrieveQueueUrl,
      });
      const { Messages: messages } = messageResponse;
      expect(messages).toHaveLength(1);
      const pendingRetrieveTranscriptJob = JSON.parse(messages[0].Body);
      console.log('pendingRetrieveTranscriptJob', pendingRetrieveTranscriptJob);
      expect(pendingRetrieveTranscriptJob.contactId).toBe(testContactId);
      expect(pendingRetrieveTranscriptJob.jobType).toBe(
        ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      );
    }
  });
});

describe('Retrieve transcript job complete', () => {
  let completedQueueUrl: string;

  beforeEach(async () => {
    completedQueueUrl = (
      await sqsClient.getQueueUrl({ QueueName: CONTACT_JOB_COMPLETE_SQS_QUEUE }).promise()
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

    let pendingRetrieveJobs: ContactJob = {} as ContactJob;
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
  });
});
