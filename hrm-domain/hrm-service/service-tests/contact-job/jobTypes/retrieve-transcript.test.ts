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
import { isAfter } from 'date-fns';
import timers from 'timers';

import { withTaskId, accountSid, workerSid } from '../../mocks';
import * as contactJobApi from '../../../src/contact-job/contact-job-data-access';
import { db } from '../../../src/connection-pool';
import '../../case-validation';
import * as conversationMediaApi from '../../../src/conversation-media/conversation-media';
import { chatChannels } from '../../../src/contact/channelTypes';
import { JOB_MAX_ATTEMPTS } from '../../../src/contact-job/contact-job-processor';

import {
  CompletedContactJobBody,
  ContactJobAttemptResult,
  ContactJobType,
} from '@tech-matters/types';
import { twilioUser } from '@tech-matters/twilio-worker-auth';

const { S3ContactMediaType, isS3StoredTranscriptPending } = conversationMediaApi;

require('../mocks');
// eslint-disable-next-line @typescript-eslint/no-shadow
const selectJobsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone<contactJobApi.ContactJobRecord>(`
      SELECT * FROM "ContactJobs"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const selectJobById = (id: number, accountSid: string) =>
  db.task(t =>
    t.oneOrNone<contactJobApi.ContactJobRecord>(`
      SELECT * FROM "ContactJobs"
      WHERE id = ${id} AND "accountSid" = '${accountSid}';
    `),
  );

let createdContact: Awaited<ReturnType<typeof contactApi.createContact>>;
let createdJobs: contactJobApi.ContactJobRecord[] = [];

const cleanupContact = () =>
  db.task(t => t.none(`DELETE FROM "Contacts" WHERE id = ${createdContact.id};`));

const cleanupContactsJobs = () => {
  const idsWhereClause = `WHERE id IN (${createdJobs.map(j => j.id).join(',')})`;
  return db.task(t => t.none(`DELETE FROM "ContactJobs" ${idsWhereClause}`));
};

let contactApi: typeof import('../../../src/contact/contact');
let SQSClient: typeof import('../../../src/contact-job/client-sqs');
let contactJobComplete: typeof import('../../../src/contact-job/contact-job-complete');
let contactJobPublish: typeof import('../../../src/contact-job/contact-job-publish');
let contactJobProcessor: typeof import('../../../src/contact-job/contact-job-processor');

beforeEach(() => {
  jest.isolateModules(() => {
    contactApi = require('../../../src/contact/contact');
    SQSClient = require('../../../src/contact-job/client-sqs');
    contactJobComplete = require('../../../src/contact-job/contact-job-complete');
    contactJobPublish = require('../../../src/contact-job/contact-job-publish');
    contactJobProcessor = require('../../../src/contact-job/contact-job-processor');
  });
});

afterEach(async () => {
  if (createdJobs.length) await cleanupContactsJobs();
  if (createdContact) await cleanupContact();
});

afterAll(async () => {
  await db.tx(async trx => {
    const contactIds = (
      await trx.manyOrNone<contactJobApi.ContactJob>(
        'DELETE FROM "ContactJobs" RETURNING *',
      )
    ).map(j => j.contactId);
    if (contactIds.length)
      await trx.none(`DELETE FROM "Contacts" WHERE id IN (${contactIds.join(',')})`);
  });
});

const createChatContact = async (channel: string, startedTimestamp: number) => {
  const contactTobeCreated = {
    ...withTaskId,
    form: {
      ...withTaskId.form,
      conversationMedia: [
        {
          store: 'S3' as const,
          type: S3ContactMediaType.TRANSCRIPT,
          location: undefined,
        },
      ],
    },
    channel,
    taskId: `${withTaskId.taskId}-${channel}`,
  };
  const contact = await contactApi.createContact(
    accountSid,
    workerSid,
    contactTobeCreated,
    {
      can: () => true,
      user: twilioUser(workerSid, []),
    },
  );

  const jobs = await selectJobsByContactId(contact.id, contact.accountSid);

  const retrieveContactTranscriptJobs = jobs.filter(
    j => j.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  );

  // This is already tested in contacts.tests, but won't harm having here
  expect(retrieveContactTranscriptJobs).toHaveLength(1);

  const retrieveContactTranscriptJob = retrieveContactTranscriptJobs[0];

  expect(isAfter(retrieveContactTranscriptJob.requested, startedTimestamp)).toBeTruthy();
  expect(retrieveContactTranscriptJob.completed).toBeNull();
  expect(retrieveContactTranscriptJob.lastAttempt).toBeNull();
  expect(retrieveContactTranscriptJob.numberOfAttempts).toBe(0);
  expect(retrieveContactTranscriptJob.completionPayload).toBeNull();

  const failurePayload = await db.oneOrNone(
    'SELECT * FROM "ContactJobsFailures" WHERE "contactJobId" = $1',
    [retrieveContactTranscriptJob.id],
  );
  expect(failurePayload).toBeNull();

  // Assign for cleanup
  createdContact = contact;
  createdJobs = jobs;

  return [contact, retrieveContactTranscriptJob, jobs] as const;
};

describe('publish retrieve-transcript job type', () => {
  each(
    chatChannels.map(channel => ({
      channel,
    })),
  ).test('$channel pending job is published when considered due', async ({ channel }) => {
    const startedTimestamp = Date.now();
    const [contact, retrieveContactTranscriptJob] = await createChatContact(
      channel,
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
      isAfter(updatedRetrieveContactTranscriptJob.lastAttempt!, startedTimestamp),
    ).toBeTruthy();
    expect(updatedRetrieveContactTranscriptJob.numberOfAttempts).toBe(1);
  });

  each(
    chatChannels.map(channel => ({
      channel,
    })),
  ).test(
    '$channel pending job is not re-published if last attempted before retry interval',
    async ({ channel }) => {
      const startedTimestamp = Date.now();
      const [contact, retrieveContactTranscriptJob] = await createChatContact(
        channel,
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
        isAfter(updatedRetrieveContactTranscriptJob.lastAttempt!, startedTimestamp),
      ).toBeTruthy();
      expect(updatedRetrieveContactTranscriptJob.numberOfAttempts).toBe(1);
    },
  );
});

describe('complete retrieve-transcript job type', () => {
  each(
    chatChannels.map(channel => ({
      channel,
    })),
  ).test(
    '$channel successful completed adds resulting transcript url and marked as complete',
    async ({ channel }) => {
      const startedTimestamp = Date.now();
      const [contact, retrieveContactTranscriptJob] = await createChatContact(
        channel,
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
        isAfter(updatedRetrieveContactTranscriptJob.completed!, startedTimestamp),
      ).toBeTruthy();
      expect(updatedRetrieveContactTranscriptJob.completionPayload).toMatchObject({
        message: 'Job processed successfully',
        value: { bucket: 'some-url-here', key: 'some-url-here' },
      });

      // Check the updated contact in the DB
      const updatedConversationMedias = await db.task(async t =>
        t.manyOrNone<conversationMediaApi.ConversationMedia>(
          `SELECT * FROM "ConversationMedias" WHERE "contactId" = ${contact.id}`,
        ),
      );

      expect(updatedConversationMedias).toHaveLength(1);
      expect(
        updatedConversationMedias?.find(conversationMediaApi.isS3StoredTranscript)
          ?.storeTypeSpecificData,
      ).toMatchObject(expectedConversationMedia);
    },
  );

  each(
    chatChannels.flatMap(channel => [
      {
        channel,
        expectMarkedAsComplete: false,
      },
      {
        channel,
        expectMarkedAsComplete: true,
      },
    ]),
  ).test(
    '$channel completed job with failure appends the failure payload with expectMarkedAsComplete "$job.expectMarkedAsComplete"',
    async ({ channel, expectMarkedAsComplete }) => {
      const startedTimestamp = Date.now();
      const [contact, retrieveContactTranscriptJob] = await createChatContact(
        channel,
        startedTimestamp,
      );

      const err = new Error('something went wrong');
      const errMessage = err instanceof Error ? err.message : String(err);

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
        conversationMediaApi,
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
          isAfter(updatedRetrieveContactTranscriptJob.completed!, startedTimestamp),
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
        t.manyOrNone<conversationMediaApi.ConversationMedia>(
          `SELECT * FROM "ConversationMedias" WHERE "contactId" = ${contact.id}`,
        ),
      );

      expect(conversationMedias.every(isS3StoredTranscriptPending)).toBeTruthy();
    },
  );
});
