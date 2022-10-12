import * as SNSClient from '../../src/contact-job/client-sns';
import * as contactJobPublish from '../../src/contact-job/contact-job-publish';
import { ContactJob, ContactJobType } from '../../src/contact-job/contact-job-data-access';
import each from 'jest-each';
import { PublishToContactJobsTopicParams } from '../../src/contact-job/contact-job-messages';

jest.mock('../../src/contact-job/client-sns');

beforeEach(() => {
  jest.resetAllMocks();
});

describe('publishDueContactJobs', () => {
  test('Invalid job format throws but does not shuts down other jobs', async () => {
    const invalidPayload = { jobType: 'invalid' };
    const validPayload: PublishToContactJobsTopicParams = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid: 'accountSid',
      attemptNumber: 1,
      contactId: 123,
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
    };

    const errorSpy = jest.spyOn(console, 'error');
    const publishRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobPublish, 'publishRetrieveContactTranscript')
      .mockImplementation(() => Promise.resolve(undefined));

    const result = await contactJobPublish.publishDueContactJobs([
      invalidPayload,
      validPayload,
    ] as any);

    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to publish due job:',
      invalidPayload,
      new Error(`Unhandled case: ${invalidPayload}`),
    );

    expect(result[0].status).toBe('rejected');
    expect(result[1].status).toBe('fulfilled');

    publishRetrieveContactTranscriptSpy.mockRestore();
  });

  test('If a job fails, it does not shuts down other jobs', async () => {
    const validPayload1 = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid: 'accountSid',
      attemptNumber: 1,
      contactId: 123,
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
    };

    const validPayload2 = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 2,
      accountSid: 'accountSid',
      attemptNumber: 1,
      contactId: 321,
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
    };

    const errorSpy = jest.spyOn(console, 'error');
    const publishRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobPublish, 'publishRetrieveContactTranscript')
      .mockImplementation(() => Promise.resolve(undefined));

    publishRetrieveContactTranscriptSpy.mockImplementationOnce(() => {
      throw new Error(':sad_trombone:');
    });

    const result = await contactJobPublish.publishDueContactJobs([
      validPayload1,
      validPayload2,
    ] as any);

    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(2);
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload1);
    expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to publish due job:',
      validPayload1,
      new Error(':sad_trombone:'),
    );

    expect(result[0].status).toBe('rejected');
    expect(result[1].status).toBe('fulfilled');

    publishRetrieveContactTranscriptSpy.mockRestore();
  });

  const dueJobsList: {
    dueJob: ContactJob;
    publishDueContactJobFunction: keyof typeof contactJobPublish;
    expectedMessageToPublish: PublishToContactJobsTopicParams;
  }[] = [
    {
      dueJob: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        id: 1,
        completed: null,
        completionPayload: null,
        additionalPayload: null,
        accountSid: 'accountSid',
        contactId: 123,
        failedAttemptsPayloads: {},
        lastAttempt: null,
        numberOfAttempts: 1,
        requested: new Date(),
        resource: {
          accountSid: 'accountSid',
          id: 123,
          taskId: 'taskId',
          twilioWorkerId: 'twilioWorkerId',
          serviceSid: 'serviceSid',
          channelSid: 'channelSid',
          createdAt: new Date('01-01-2022'),
          csamReports: [],
        },
      },
      publishDueContactJobFunction: 'publishRetrieveContactTranscript',
      expectedMessageToPublish: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        jobId: 1,
        contactId: 123,
        accountSid: 'accountSid',
        channelSid: 'channelSid',
        serviceSid: 'serviceSid',
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        filePath: 'transcripts/2022/01/01/20220101000000-taskId.json',
        attemptNumber: 1,
      },
    },
  ];

  test('Check that we are testing all the possible job types (useful for the next test)', () => {
    expect(dueJobsList.length).toBe(Object.values(ContactJobType).length);

    Object.values(ContactJobType).forEach(jobType => {
      expect(dueJobsList.some(({ dueJob }) => dueJob.jobType === jobType)).toBeTruthy();
    });
  });

  each(dueJobsList).test(
    '$dueJob.jobType job is processed accordingly and published via SNS client',
    async ({ dueJob, publishDueContactJobFunction, expectedMessageToPublish }) => {
      const publishToContactJobsTopicSpy = jest
        .spyOn(SNSClient, 'publishToContactJobsTopic')
        .mockImplementation(() => Promise.resolve(undefined));
      const publishDueContactJobFunctionSpy = jest.spyOn(
        contactJobPublish,
        publishDueContactJobFunction,
      );

      console.log(await contactJobPublish.publishRetrieveContactTranscript(dueJob));

      const result = await contactJobPublish.publishDueContactJobs([dueJob]);

      expect(publishDueContactJobFunctionSpy).toHaveBeenCalledWith(dueJob);
      expect(publishToContactJobsTopicSpy).toHaveBeenCalledWith(expectedMessageToPublish);

      expect(result[0].status).toBe('fulfilled');
    },
  );
});
