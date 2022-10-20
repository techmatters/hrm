import each from 'jest-each';

import * as SQSClient from '../../src/contact-job/client-sqs';
import * as contactJobDataAccess from '../../src/contact-job/contact-job-data-access';
import * as contactJobComplete from '../../src/contact-job/contact-job-complete';
import { ContactJobType } from '../../src/contact-job/contact-job-data-access';
import { JOB_MAX_ATTEMPTS } from '../../src/contact-job/contact-job-processor';

// eslint-disable-next-line prettier/prettier
import type { CompletedContactJobBody } from '@tech-matters/hrm-types/ContactJob';

jest.mock('../../src/contact-job/client-sqs');

afterEach(() => {
  jest.clearAllMocks();
});

describe('pollAndprocessCompletedContactJobs', () => {
  test('Completed jobs are polled from SQS client as expected', async () => {
    const sqsSpy = jest
      .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
      .mockImplementation(async () => ({
        Messages: [],
      }));

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

    expect(sqsSpy).toHaveBeenCalled();
    expect(Array.isArray(result)).toBeTruthy();
    expect(result.length).toBe(0);
  });

  test('Invalid job format throws but does not shuts down other jobs', async () => {
    const invalidPayload = {
      Body: JSON.stringify({ jobType: 'invalid', attemptResult: 'success' }),
      ReceiptHandle: 'invalid',
    };
    const valid1: CompletedContactJobBody = {
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
      attemptPayload: 'some-url-here',
      attemptResult: 'success',
    };
    const validPayload = {
      Body: JSON.stringify(valid1),
      ReceiptHandle: 'valid',
    };

    jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(async () => ({
      Messages: [invalidPayload, validPayload],
    }));
    const errorSpy = jest.spyOn(console, 'error');
    const processCompletedRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
      .mockImplementation(async () => {});

    jest
      .spyOn(contactJobDataAccess, 'completeContactJob')
      .mockImplementation(async () => 'done' as any);

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to process CompletedContactJobBody:',
      invalidPayload,
      new Error(`Unhandled case: ${invalidPayload}`),
    );

    expect(result[0].status).toBe('rejected');
    expect(result[1].status).toBe('fulfilled');
  });

  test('If a job fails, it does not shuts down other jobs', async () => {
    const valid1: CompletedContactJobBody = {
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
      attemptPayload: 'some-url-here',
      attemptResult: 'success',
    };

    const validPayload1 = {
      Body: JSON.stringify(valid1),
      ReceiptHandle: 'valid',
    };

    const valid2 = { ...valid1, jobId: 2, contactId: 321 };
    const validPayload2 = {
      Body: JSON.stringify(valid2),
      ReceiptHandle: 'valid',
    };

    jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(async () => ({
      Messages: [validPayload1, validPayload2],
    }));
    const errorSpy = jest.spyOn(console, 'error');
    const processCompletedRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
      .mockImplementation(async () => {});

    processCompletedRetrieveContactTranscriptSpy.mockImplementationOnce(() => {
      throw new Error(':sad_trombone:');
    });

    jest
      .spyOn(contactJobDataAccess, 'completeContactJob')
      .mockImplementation(async () => 'done' as any);

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to process CompletedContactJobBody:',
      validPayload1,
      new Error(':sad_trombone:'),
    );

    expect(result[0].status).toBe('rejected');
    expect(result[1].status).toBe('fulfilled');
  });

  const completedJobsList: {
    job: CompletedContactJobBody;
    processCompletedFunction: keyof typeof contactJobComplete;
  }[] = [
    {
      job: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        attemptResult: 'success',
        jobId: 1,
        accountSid: 'accountSid',
        contactId: 123,
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        serviceSid: 'serviceSid',
        channelSid: 'channelSid',
        filePath: 'filePath',
        attemptNumber: 1,
        attemptPayload: 'completionPayload',
      },
      processCompletedFunction: 'processCompletedRetrieveContactTranscript',
    },
  ];

  test('Check that we are testing all the possible job types (useful for the next test)', () => {
    expect(completedJobsList.length).toBe(Object.values(ContactJobType).length);

    Object.values(ContactJobType).forEach(jobType => {
      expect(completedJobsList.some(({ job }) => job.jobType === jobType)).toBeTruthy();
    });
  });

  each(completedJobsList).test(
    '$job.jobType successful job is processed accordingly',
    async ({ job, processCompletedFunction }) => {
      const validPayload = {
        Body: JSON.stringify(job),
        ReceiptHandle: 'valid',
      };

      jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(async () => ({
        Messages: [validPayload],
      }));
      const deletedCompletedContactJobsSpy = jest
        .spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue')
        .mockImplementation(async () => {});
      const processCompletedFunctionSpy = jest
        .spyOn(contactJobComplete, processCompletedFunction)
        .mockImplementation(async () => {});
      const completeContactJobSpy = jest
        .spyOn(contactJobDataAccess, 'completeContactJob')
        .mockImplementation(async () => validPayload as any);

      const result = await contactJobComplete.pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

      expect(processCompletedFunctionSpy).toHaveBeenCalledWith(job);
      expect(completeContactJobSpy).toHaveBeenCalledWith(job.jobId, {
        message: 'Job processed successfully',
        value: job.attemptPayload,
      });
      expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(validPayload.ReceiptHandle);

      expect(result[0].status).toBe('fulfilled');
    },
  );

  const failedJobsList: {
    job: CompletedContactJobBody;
    processCompletedFunction: keyof typeof contactJobComplete;
    expectMarkedAsComplete: boolean;
  }[] = [
    {
      job: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        attemptResult: 'failure',
        jobId: 1,
        accountSid: 'accountSid',
        contactId: 123,
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        serviceSid: 'serviceSid',
        channelSid: 'channelSid',
        filePath: 'filePath',
        attemptNumber: 1,
        attemptPayload: 'failed attemptPayload',
      },
      processCompletedFunction: 'processCompletedRetrieveContactTranscript',
      expectMarkedAsComplete: false,
    },
  ];

  test('Check that we are testing all the possible job types (useful for the next test)', () => {
    expect(failedJobsList.length).toBe(Object.values(ContactJobType).length);

    Object.values(ContactJobType).forEach(jobType => {
      expect(failedJobsList.some(({ job }) => job.jobType === jobType)).toBeTruthy();
    });
  });

  each(
    // Per each test case, add an identical one but that should be marked as complete
    failedJobsList.flatMap(testCase => [
      testCase,
      {
        ...testCase,
        job: { ...testCase.job, attemptNumber: JOB_MAX_ATTEMPTS },
        expectMarkedAsComplete: true,
      },
    ]),
  ).test(
    '$job.jobType failed job is processed accordingly with expectMarkedAsComplete "$expectMarkedAsComplete"',
    async ({ job, processCompletedFunction, expectMarkedAsComplete }) => {
      const validPayload = {
        Body: JSON.stringify(job),
        ReceiptHandle: 'valid',
      };

      jest.spyOn(SQSClient, 'pollCompletedContactJobsFromQueue').mockImplementation(async () => ({
        Messages: [validPayload],
      }));
      const deletedCompletedContactJobsSpy = jest
        .spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue')
        .mockImplementation(async () => {});
      const processCompletedFunctionSpy = jest
        .spyOn(contactJobComplete, processCompletedFunction)
        .mockImplementation(async () => {});
      const completeContactJobSpy = jest
        .spyOn(contactJobDataAccess, 'completeContactJob')
        .mockImplementation(async () => job);
      const appendFailedAttemptPayloadSpy = jest
        .spyOn(contactJobDataAccess, 'appendFailedAttemptPayload')
        .mockImplementation(() => job);

      const result = await contactJobComplete.pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

      expect(processCompletedFunctionSpy).not.toHaveBeenCalled();

      if (expectMarkedAsComplete) {
        expect(completeContactJobSpy).toHaveBeenCalledWith(job.jobId, {
          message: 'Attempts limit reached',
        });
        expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(validPayload.ReceiptHandle);
      } else {
        expect(completeContactJobSpy).not.toHaveBeenCalled();
        expect(deletedCompletedContactJobsSpy).not.toHaveBeenCalled();
      }

      expect(appendFailedAttemptPayloadSpy).toHaveBeenCalledWith(
        job.jobId,
        job.attemptNumber,
        job.attemptPayload,
      );

      expect(result[0].status).toBe('fulfilled');
    },
  );
});
