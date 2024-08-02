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

import each from 'jest-each';
import { isAfter, parseISO } from 'date-fns';
import timers from 'timers';

import { withTaskId, accountSid, workerSid } from '../../mocks';
import { db } from '@tech-matters/hrm-core/connection-pool';
import '../../case/caseValidation';
import * as conversationMediaApi from '@tech-matters/hrm-core/conversation-media/conversation-media';
import { JOB_MAX_ATTEMPTS } from '@tech-matters/hrm-core/contact-job/contact-job-processor';

import {
  CompletedContactJobBody,
  ContactJobAttemptResult,
  ContactJobType,
} from '@tech-matters/types';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { NewConversationMedia } from '@tech-matters/hrm-core/conversation-media/conversation-media';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { clearAllTables } from '../../dbCleanup';

const { S3ContactMediaType, isS3StoredTranscriptPending } = conversationMediaApi;

require('../mocks');
// eslint-disable-next-line @typescript-eslint/no-shadow
const selectJobsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      SELECT * FROM "ContactJobs"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const selectJobById = (id: number, accountSid: string) =>
  db.task(t =>
    t.oneOrNone(`
      SELECT * FROM "ContactJobs"
      WHERE id = ${id} AND "accountSid" = '${accountSid}';
    `),
  );

let contactApi: typeof import('@tech-matters/hrm-core/contact/contactService');
let SQSClient: typeof import('@tech-matters/hrm-core/contact-job/client-sqs');
let contactJobComplete: typeof import('@tech-matters/hrm-core/contact-job/contact-job-complete');
let contactJobPublish: typeof import('@tech-matters/hrm-core/contact-job/contact-job-publish');
let contactJobProcessor: typeof import('@tech-matters/hrm-core/contact-job/contact-job-processor');

beforeEach(() => {
  jest.isolateModules(() => {
    contactApi = require('@tech-matters/hrm-core/contact/contactService');
    SQSClient = require('@tech-matters/hrm-core/contact-job/client-sqs');
    contactJobComplete = require('@tech-matters/hrm-core/contact-job/contact-job-complete');
    contactJobPublish = require('@tech-matters/hrm-core/contact-job/contact-job-publish');
    contactJobProcessor = require('@tech-matters/hrm-core/contact-job/contact-job-processor');
  });
});

afterEach(clearAllTables);

const SAMPLE_CONVERSATION_MEDIA: NewConversationMedia = {
  storeType: 'S3' as const,
  storeTypeSpecificData: {
    type: S3ContactMediaType.TRANSCRIPT,
    location: undefined,
  },
};

const createChatContact = async (channel: string, startedTimestamp: number) => {
  const contactTobeCreated: NewContactRecord = {
    ...withTaskId,
    channel,
    taskId: `${withTaskId.taskId}-${channel}`,
  };
  let contact = await contactApi.createContact(
    accountSid,
    workerSid,
    contactTobeCreated,
    {
      can: () => true,
      user: newTwilioUser(accountSid, workerSid, []),
    },
    true,
  );

  contact = await contactApi.addConversationMediaToContact(
    accountSid,
    contact.id.toString(),
    [SAMPLE_CONVERSATION_MEDIA],
    {
      can: () => true,
      user: newTwilioUser(accountSid, workerSid, []),
    },
    true,
  );

  const jobs = await selectJobsByContactId(contact.id, contact.accountSid);

  const retrieveContactTranscriptJobs = jobs.filter(
    j => j.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  );

  // This is already tested in contacts.tests, but won't harm having here
  expect(retrieveContactTranscriptJobs).toHaveLength(1);

  const retrieveContactTranscriptJob = retrieveContactTranscriptJobs[0];

  expect(
    isAfter(parseISO(retrieveContactTranscriptJob.requested), startedTimestamp),
  ).toBeTruthy();
  expect(retrieveContactTranscriptJob.completed).toBeNull();
  expect(retrieveContactTranscriptJob.lastAttempt).toBeNull();
  expect(retrieveContactTranscriptJob.numberOfAttempts).toBe(0);
  expect(retrieveContactTranscriptJob.completionPayload).toBeNull();

  const failurePayload = await db.oneOrNone(
    'SELECT * FROM "ContactJobsFailures" WHERE "contactJobId" = $1',
    [retrieveContactTranscriptJob.id],
  );
  expect(failurePayload).toBeNull();

  return [contact, retrieveContactTranscriptJob, jobs] as const;
};

describe('publish retrieve-transcript job type', () => {
  test('$channel pending job is published when considered due', async () => {
    const startedTimestamp = Date.now();
    const [contact, retrieveContactTranscriptJob] = await createChatContact(
      'carrier pigeon',
      startedTimestamp,
    );

    const publishDueContactJobsSpy = jest.spyOn(
      contactJobPublish,
      'publishDueContactJobs',
    );
    const publishRetrieveContactTranscriptSpy = jest.spyOn(
      contactJobPublish,
      'publishRetrieveContactTranscript',
    );

    // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
    // const setIntervalSpy =
    jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
      return callback as any;
    });

    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(0);

    const processorIntervalCallback =
      contactJobProcessor.processContactJobs() as unknown as () => Promise<void>;

    await processorIntervalCallback();

    const updatedRetrieveContactTranscriptJob = await selectJobById(
      retrieveContactTranscriptJob.id,
      accountSid,
    );

    // Publish face is invoked
    expect(publishDueContactJobsSpy).toHaveBeenCalledTimes(1);
    // And previous job was considered due
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith({
      ...retrieveContactTranscriptJob,
      lastAttempt: expect.toParseAsDate(),
      numberOfAttempts: 1,
      resource: {
        ...contact,
        conversationMedia: contact.conversationMedia?.map(cm => ({
          ...cm,
          createdAt: expect.toParseAsDate(cm.createdAt),
          updatedAt: expect.toParseAsDate(cm.updatedAt),
        })),
        finalizedAt: expect.toParseAsDate(contact.finalizedAt),
        createdAt: expect.toParseAsDate(contact.createdAt),
        updatedAt: expect.toParseAsDate(contact.updatedAt),
        timeOfContact: expect.toParseAsDate(contact.timeOfContact),
      },
    });

    // Check the updated job in the DB
    if (!updatedRetrieveContactTranscriptJob)
      throw new Error('updatedRetrieveContactTranscriptJob is null!');

    expect(updatedRetrieveContactTranscriptJob.completed).toBeNull();

    expect(
      isAfter(
        parseISO(updatedRetrieveContactTranscriptJob.lastAttempt),
        startedTimestamp,
      ),
    ).toBeTruthy();
    expect(updatedRetrieveContactTranscriptJob.numberOfAttempts).toBe(1);
  });

  test('$channel pending job is not re-published if last attempted before retry interval', async () => {
    const startedTimestamp = Date.now();
    const [contact, retrieveContactTranscriptJob] = await createChatContact(
      'carrier pigeon',
      startedTimestamp,
    );

    const publishDueContactJobsSpy = jest.spyOn(
      contactJobPublish,
      'publishDueContactJobs',
    );
    const publishRetrieveContactTranscriptSpy = jest.spyOn(
      contactJobPublish,
      'publishRetrieveContactTranscript',
    );

    // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
    // const setIntervalSpy =
    jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
      return callback as any;
    });

    const processorIntervalCallback =
      contactJobProcessor.processContactJobs() as unknown as () => Promise<void>;

    await processorIntervalCallback();
    await processorIntervalCallback();

    // Publish face is invoked
    expect(publishDueContactJobsSpy).toHaveBeenCalledTimes(2);
    // And previous job was considered due
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith({
      ...retrieveContactTranscriptJob,
      lastAttempt: expect.toParseAsDate(),
      numberOfAttempts: 1,
      resource: {
        ...contact,
        conversationMedia: contact.conversationMedia?.map(cm => ({
          ...cm,
          createdAt: expect.toParseAsDate(cm.createdAt),
          updatedAt: expect.toParseAsDate(cm.updatedAt),
        })),
        createdAt: expect.toParseAsDate(contact.createdAt),
        finalizedAt: expect.toParseAsDate(contact.finalizedAt),
        updatedAt: expect.toParseAsDate(contact.updatedAt),
        timeOfContact: expect.toParseAsDate(contact.timeOfContact),
      },
    });

    // Check the updated job in the DB
    const updatedRetrieveContactTranscriptJob = await selectJobById(
      retrieveContactTranscriptJob.id,
      accountSid,
    );

    if (!updatedRetrieveContactTranscriptJob)
      throw new Error('updatedRetrieveContactTranscriptJob is null!');

    expect(updatedRetrieveContactTranscriptJob.completed).toBeNull();
    expect(
      isAfter(
        parseISO(updatedRetrieveContactTranscriptJob.lastAttempt),
        startedTimestamp,
      ),
    ).toBeTruthy();
    expect(updatedRetrieveContactTranscriptJob.numberOfAttempts).toBe(1);
  });
});

describe('complete retrieve-transcript job type', () => {
  test('$channel successful completed adds resulting transcript url and marked as complete', async () => {
    const startedTimestamp = Date.now();
    const [contact, retrieveContactTranscriptJob] = await createChatContact(
      'carrier pigeon',
      startedTimestamp,
    );

    const completedPayload: CompletedContactJobBody = {
      accountSid: retrieveContactTranscriptJob.accountSid,
      channelSid: contact.channelSid,
      contactId: contact.id,
      conversationMediaId: contact.conversationMedia?.find(
        conversationMediaApi.isS3StoredTranscript,
      )?.id,
      filePath: 'the-path-file-sent',
      jobId: retrieveContactTranscriptJob.id,
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      serviceSid: contact.serviceSid,
      taskId: contact.taskId,
      twilioWorkerId: contact.twilioWorkerId,
      attemptPayload: {
        bucket: 'some-url-here',
        key: 'some-url-here',
      },
      attemptNumber: 1,
      attemptResult: ContactJobAttemptResult.SUCCESS,
    };

    // const pollCompletedContactJobsSpy =
    jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(() =>
      Promise.resolve({
        $metadata: {},
        Messages: [
          {
            ReceiptHandle: retrieveContactTranscriptJob.id.toString(),
            Body: JSON.stringify(completedPayload),
          },
        ],
      }),
    );

    jest
      .spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue')
      .mockImplementation(() => Promise.resolve() as any);

    const processCompletedRetrieveContactTranscriptSpy = jest.spyOn(
      contactJobComplete,
      'processCompletedRetrieveContactTranscript',
    );
    const publishDueContactJobsSpy = jest.spyOn(
      contactJobPublish,
      'publishDueContactJobs',
    );
    const publishRetrieveContactTranscriptSpy = jest.spyOn(
      contactJobPublish,
      'publishRetrieveContactTranscript',
    );

    // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
    // const setIntervalSpy =
    jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
      return callback as any;
    });

    const processorIntervalCallback =
      contactJobProcessor.processContactJobs() as unknown as () => Promise<void>;

    await processorIntervalCallback();

    const expectedConversationMedia = {
      type: 'transcript',
      location: {
        bucket: 'some-url-here',
        key: 'some-url-here',
      },
    };

    // Expect that proper code flow was executed
    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledWith(
      completedPayload,
    );

    // Publish face is invoked
    expect(publishDueContactJobsSpy).toHaveBeenCalledTimes(1);
    // But previous job is completed hence not retrieved as due
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(0);

    // Check the completed job in the DB
    const updatedRetrieveContactTranscriptJob = await selectJobById(
      retrieveContactTranscriptJob.id,
      accountSid,
    );

    if (!updatedRetrieveContactTranscriptJob)
      throw new Error('updatedRetrieveContactTranscriptJob is null!');

    expect(
      isAfter(parseISO(updatedRetrieveContactTranscriptJob.completed), startedTimestamp),
    ).toBeTruthy();
    expect(updatedRetrieveContactTranscriptJob.completionPayload).toMatchObject({
      message: 'Job processed successfully',
      value: { bucket: 'some-url-here', key: 'some-url-here' },
    });

    // Check the updated contact in the DB
    const updatedConversationMedias = await db.task(async t =>
      t.manyOrNone(
        `SELECT * FROM "ConversationMedias" WHERE "contactId" = ${contact.id}`,
      ),
    );

    expect(updatedConversationMedias).toHaveLength(1);
    expect(
      updatedConversationMedias?.find(conversationMediaApi.isS3StoredTranscript)
        ?.storeTypeSpecificData,
    ).toMatchObject(expectedConversationMedia);
  });

  each([
    {
      expectMarkedAsComplete: false,
    },
    {
      expectMarkedAsComplete: true,
    },
  ]).test(
    '$channel completed job with failure appends the failure payload with expectMarkedAsComplete "$job.expectMarkedAsComplete"',
    async ({ expectMarkedAsComplete }) => {
      const startedTimestamp = Date.now();
      const [contact, retrieveContactTranscriptJob] = await createChatContact(
        'carrier pigeon',
        startedTimestamp,
      );

      const err = new Error('something went wrong');
      const errMessage = err.message;

      const completedPayload: CompletedContactJobBody = {
        accountSid: retrieveContactTranscriptJob.accountSid,
        channelSid: contact.channelSid,
        contactId: contact.id,
        conversationMediaId: contact.conversationMedia?.find(
          conversationMediaApi.isS3StoredTranscript,
        )?.id,
        filePath: 'the-path-file-sent',
        jobId: retrieveContactTranscriptJob.id,
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        serviceSid: contact.serviceSid,
        taskId: contact.taskId,
        twilioWorkerId: contact.twilioWorkerId,
        attemptPayload: errMessage,
        attemptNumber: !expectMarkedAsComplete ? 1 : JOB_MAX_ATTEMPTS,
        attemptResult: ContactJobAttemptResult.FAILURE,
      };

      // const pollCompletedContactJobsSpy =
      jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(() =>
        Promise.resolve({
          $metadata: {},
          Messages: [
            {
              ReceiptHandle: retrieveContactTranscriptJob.id.toString(),
              Body: JSON.stringify(completedPayload),
            },
          ],
        }),
      );
      jest
        .spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue')
        .mockImplementation(() => Promise.resolve() as any);

      const processCompletedRetrieveContactTranscriptSpy = jest.spyOn(
        contactJobComplete,
        'processCompletedRetrieveContactTranscript',
      );
      const publishDueContactJobsSpy = jest.spyOn(
        contactJobPublish,
        'publishDueContactJobs',
      );
      // const publishRetrieveContactTranscriptSpy = jest.spyOn(
      //   contactJobPublish,
      //   'publishRetrieveContactTranscript',
      // );

      const updateConversationMediaSpy = jest.spyOn(
        contactApi,
        'updateConversationMediaData',
      );

      // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
      // const setIntervalSpy =
      jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
        return callback as any;
      });

      const processorIntervalCallback =
        contactJobProcessor.processContactJobs() as unknown as () => Promise<void>;

      await processorIntervalCallback();

      // Expect that proper code flow was executed
      expect(processCompletedRetrieveContactTranscriptSpy).not.toHaveBeenCalled();
      expect(updateConversationMediaSpy).not.toHaveBeenCalled();

      // Publish face is invoked
      expect(publishDueContactJobsSpy).toHaveBeenCalledTimes(1);

      // Check the completed job in the DB
      const updatedRetrieveContactTranscriptJob = await selectJobById(
        retrieveContactTranscriptJob.id,
        accountSid,
      );

      if (!updatedRetrieveContactTranscriptJob)
        throw new Error('updatedRetrieveContactTranscriptJob is null!');

      const failurePayload = await db.oneOrNone(
        'SELECT * FROM "ContactJobsFailures" WHERE "contactJobId" = $1 AND "attemptNumber" = $2',
        [retrieveContactTranscriptJob.id, completedPayload.attemptNumber],
      );
      expect(failurePayload.payload).toMatch(completedPayload.attemptPayload);

      if (expectMarkedAsComplete) {
        // And previous job is not completed hence retrieved as due
        // expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);

        expect(
          isAfter(
            parseISO(updatedRetrieveContactTranscriptJob.completed),
            startedTimestamp,
          ),
        ).toBeTruthy();
        expect(updatedRetrieveContactTranscriptJob.completionPayload).toMatchObject({
          message: 'Attempts limit reached',
        });
      } else {
        // But previous job is completed hence not retrieved as due
        // expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(0);
        expect(updatedRetrieveContactTranscriptJob.completed).toBeNull();
        expect(updatedRetrieveContactTranscriptJob.completionPayload).toBeNull();
      }

      // Check the updated contact in the DB
      const conversationMedias = await db.task(async t =>
        t.manyOrNone(
          `SELECT * FROM "ConversationMedias" WHERE "contactId" = ${contact.id}`,
        ),
      );

      expect(conversationMedias.every(isS3StoredTranscriptPending)).toBeTruthy();
    },
  );
});
