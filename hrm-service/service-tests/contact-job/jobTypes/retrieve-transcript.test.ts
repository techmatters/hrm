import { isAfter } from 'date-fns';
import each from 'jest-each';
import timers from 'timers';

import { withTaskId, accountSid, workerSid } from '../../mocks';
import * as contactJobApi from '../../../src/contact-job/contact-job-data-access';
import { db } from '../../../src/connection-pool';
import '../../case-validation';
import { CompletedContactJobBody } from '../../../src/contact-job/contact-job-messages';
import { ContactMediaType, isS3StoredTranscriptPending } from '../../../src/contact/contact-json';
import { Contact } from '../../../src/contact/contact';
import { chatChannels } from '../../../src/contact/channelTypes';
import { JOB_MAX_ATTEMPTS } from '../../../src/contact-job/contact-job-processor';

jest.mock('../../../src/contact-job/client-sns');

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
    const contactIds = await trx.manyOrNone('DELETE FROM "ContactJobs" RETURNING *');
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
          type: ContactMediaType.TRANSCRIPT,
          url: undefined,
        },
      ],
    },
    channel,
    taskId: `${withTaskId.taskId}-${channel}`,
  };
  const contact = await contactApi.createContact(accountSid, workerSid, contactTobeCreated);

  const jobs = await selectJobsByContactId(contact.id, contact.accountSid);

  const retrieveContactTranscriptJobs = jobs.filter(
    j => j.jobType === contactJobApi.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  );

  // This is already tested in contacts.tests, but won't harm having here
  expect(retrieveContactTranscriptJobs).toHaveLength(1);

  const retrieveContactTranscriptJob = retrieveContactTranscriptJobs[0];

  expect(isAfter(retrieveContactTranscriptJob.requested, startedTimestamp)).toBeTruthy();
  expect(retrieveContactTranscriptJob.completed).toBeNull();
  expect(retrieveContactTranscriptJob.lastAttempt).toBeNull();
  expect(retrieveContactTranscriptJob.numberOfAttempts).toBe(0);
  expect(retrieveContactTranscriptJob.failedAttemptsPayloads).toMatchObject({});
  expect(retrieveContactTranscriptJob.completionPayload).toBeNull();

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

    const publishDueContactJobsSpy = jest.spyOn(contactJobPublish, 'publishDueContactJobs');
    const publishRetrieveContactTranscriptSpy = jest.spyOn(
      contactJobPublish,
      'publishRetrieveContactTranscript',
    );

    // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
    // const setIntervalSpy =
    jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
      return callback as any;
    });

    const processorIntervalCallback = (contactJobProcessor.processContactJobs() as unknown) as () => Promise<
      void
    >;

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

      const publishDueContactJobsSpy = jest.spyOn(contactJobPublish, 'publishDueContactJobs');
      const publishRetrieveContactTranscriptSpy = jest.spyOn(
        contactJobPublish,
        'publishRetrieveContactTranscript',
      );

      // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
      // const setIntervalSpy =
      jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
        return callback as any;
      });

      const processorIntervalCallback = (contactJobProcessor.processContactJobs() as unknown) as () => Promise<
        void
      >;

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
        filePath: 'the-path-file-sent',
        jobId: retrieveContactTranscriptJob.id,
        jobType: contactJobApi.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        serviceSid: contact.serviceSid,
        taskId: contact.taskId,
        twilioWorkerId: contact.twilioWorkerId,
        attemptPayload: 'some-url-here',
        attemptNumber: 1,
        attemptResult: 'success',
      };

      // const pollCompletedContactJobsSpy =
      jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(() =>
        Promise.resolve({
          Messages: [
            {
              ReceiptHandle: retrieveContactTranscriptJob.id.toString(),
              Body: JSON.stringify(completedPayload),
            },
          ],
        }),
      );

      const processCompletedRetrieveContactTranscriptSpy = jest.spyOn(
        contactJobComplete,
        'processCompletedRetrieveContactTranscript',
      );
      const publishDueContactJobsSpy = jest.spyOn(contactJobPublish, 'publishDueContactJobs');
      const publishRetrieveContactTranscriptSpy = jest.spyOn(
        contactJobPublish,
        'publishRetrieveContactTranscript',
      );

      const updateConversationMediaSpy = jest.spyOn(contactApi, 'updateConversationMedia');

      // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
      // const setIntervalSpy =
      jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
        return callback as any;
      });

      const processorIntervalCallback = (contactJobProcessor.processContactJobs() as unknown) as () => Promise<
        void
      >;

      await processorIntervalCallback();

      const expecteConversationMedia = [
        {
          store: 'S3',
          url: completedPayload.attemptPayload,
          type: ContactMediaType.TRANSCRIPT,
        },
      ];

      // Expect that proper code flow was executed
      expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledWith(completedPayload);
      expect(updateConversationMediaSpy).toHaveBeenCalledWith(
        completedPayload.accountSid,
        completedPayload.contactId,
        expecteConversationMedia,
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
        value: 'some-url-here',
      });

      // Check the updated contact in the DB
      const updatedContact = await db.task(async t =>
        t.oneOrNone<Contact>(`SELECT * FROM "Contacts" WHERE id = ${contact.id}`),
      );

      expect(updatedContact?.rawJson?.conversationMedia).toHaveLength(1);
      expect(updatedContact?.rawJson?.conversationMedia).toMatchObject(expecteConversationMedia);
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
      const errToObject = Object.fromEntries(Object.getOwnPropertyNames(err).map(n => [n, err[n]]));

      const completedPayload: CompletedContactJobBody = {
        accountSid: retrieveContactTranscriptJob.accountSid,
        channelSid: contact.channelSid,
        contactId: contact.id,
        filePath: 'the-path-file-sent',
        jobId: retrieveContactTranscriptJob.id,
        jobType: contactJobApi.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        serviceSid: contact.serviceSid,
        taskId: contact.taskId,
        twilioWorkerId: contact.twilioWorkerId,
        attemptPayload: errToObject,
        attemptNumber: !expectMarkedAsComplete ? 1 : JOB_MAX_ATTEMPTS,
        attemptResult: 'failure',
      };

      // const pollCompletedContactJobsSpy =
      jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(() =>
        Promise.resolve({
          Messages: [
            {
              ReceiptHandle: retrieveContactTranscriptJob.id.toString(),
              Body: JSON.stringify(completedPayload),
            },
          ],
        }),
      );

      const processCompletedRetrieveContactTranscriptSpy = jest.spyOn(
        contactJobComplete,
        'processCompletedRetrieveContactTranscript',
      );
      const publishDueContactJobsSpy = jest.spyOn(contactJobPublish, 'publishDueContactJobs');
      // const publishRetrieveContactTranscriptSpy = jest.spyOn(
      //   contactJobPublish,
      //   'publishRetrieveContactTranscript',
      // );

      const updateConversationMediaSpy = jest.spyOn(contactApi, 'updateConversationMedia');

      // Mock setInterval to return the internal cb instead than it's interval id, so we can call it when we want
      // const setIntervalSpy =
      jest.spyOn(timers, 'setInterval').mockImplementation(callback => {
        return callback as any;
      });

      const processorIntervalCallback = (contactJobProcessor.processContactJobs() as unknown) as () => Promise<
        void
      >;

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

      expect(
        updatedRetrieveContactTranscriptJob.failedAttemptsPayloads[completedPayload.attemptNumber],
      ).toContainEqual(expect.objectContaining(completedPayload.attemptPayload));

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
      const updatedContact = await db.task(async t =>
        t.oneOrNone<Contact>(`SELECT * FROM "Contacts" WHERE id = ${contact.id}`),
      );

      expect(
        updatedContact?.rawJson?.conversationMedia?.every(isS3StoredTranscriptPending),
      ).toBeTruthy();
    },
  );
});
