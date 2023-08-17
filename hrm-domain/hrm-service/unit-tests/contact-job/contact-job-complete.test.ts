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

import * as SQSClient from '../../src/contact-job/client-sqs';
import * as contactJobDataAccess from '../../src/contact-job/contact-job-data-access';
import * as contactJobComplete from '../../src/contact-job/contact-job-complete';
import { ContactJobPollerError } from '../../src/contact-job/contact-job-error';
import { ContactJobType, ContactJobAttemptResult } from '@tech-matters/types';
import { JOB_MAX_ATTEMPTS } from '../../src/contact-job/contact-job-processor';

import type { CompletedContactJobBody } from '@tech-matters/types';

jest.mock('../../src/contact-job/client-sqs');

jest.mock('../../src/contact-job/contact-job-data-access', () => {
  const mockJob = {
    id: 1,
    contactId: 123,
    accountSid: 'accountSid',
    jobType: 'retrieve-transcript',
    requested: new Date(),
    completed: null,
    lastAttempt: new Date(),
    numberOfAttempts: 5,
    additionalPayload: null,
    completionPayload: null,
  };

  return {
    appendFailedAttemptPayload: jest.fn().mockResolvedValue(true),
    completeContactJob: jest.fn().mockResolvedValue(mockJob),
    getContactJobById: jest.fn().mockResolvedValue(mockJob),
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('pollAndProcessCompletedContactJobs', () => {
  test('Completed jobs are polled from SQS client as expected', async () => {
    const sqsSpy = jest
      .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
      .mockImplementation(async () => ({
        $metadata: {},
        Messages: [],
      }));

    const result = await contactJobComplete.pollAndProcessCompletedContactJobs(
      JOB_MAX_ATTEMPTS,
    );

    expect(sqsSpy).toHaveBeenCalled();
    expect(Array.isArray(result)).toBeTruthy();
    expect(result?.length).toBe(0);
  });

  test('Invalid job format throws but does not shuts down other jobs', async () => {
    const invalidPayload = {
      Body: JSON.stringify({
        jobType: 'invalid',
        attemptResult: ContactJobAttemptResult.SUCCESS,
      }),
      ReceiptHandle: 'invalid',
    };
    const valid1: CompletedContactJobBody = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid: 'accountSid',
      attemptNumber: 1,
      contactId: 123,
      conversationMediaId: 999,
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
      attemptResult: ContactJobAttemptResult.SUCCESS,
      attemptPayload: {
        bucket: 'some-url-here',
        key: 'some-url-here',
      },
    };
    const validPayload = {
      Body: JSON.stringify(valid1),
      ReceiptHandle: 'valid',
    };

    jest
      .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
      .mockImplementation(async () => ({
        $metadata: {},
        Messages: [invalidPayload, validPayload],
      }));
    const errorSpy = jest.spyOn(console, 'error');
    const processCompletedRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
      .mockImplementation(async () => {});

    jest
      .spyOn(contactJobDataAccess, 'completeContactJob')
      .mockImplementation(async () => 'done' as any);

    const result = await contactJobComplete.pollAndProcessCompletedContactJobs(
      JOB_MAX_ATTEMPTS,
    );

    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      new ContactJobPollerError('Failed to process CompletedContactJobBody:'),
      invalidPayload,
      new Error(`Unhandled case: ${invalidPayload}`),
    );

    expect(result?.[0].status).toBe('rejected');
    expect(result?.[1].status).toBe('fulfilled');
  });

  test('If a job fails, it does not shuts down other jobs', async () => {
    const valid1: CompletedContactJobBody = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid: 'accountSid',
      attemptNumber: 1,
      contactId: 123,
      conversationMediaId: 999,
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
      attemptResult: ContactJobAttemptResult.SUCCESS,
      attemptPayload: {
        bucket: 'some-url-here',
        key: 'some-url-here',
      },
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

    jest
      .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
      .mockImplementation(async () => ({
        $metadata: {},
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

    const result = await contactJobComplete.pollAndProcessCompletedContactJobs(
      JOB_MAX_ATTEMPTS,
    );

    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      new ContactJobPollerError('Failed to process CompletedContactJobBody:'),
      validPayload1,
      new Error(':sad_trombone:'),
    );

    expect(result?.[0].status).toBe('rejected');
    expect(result?.[1].status).toBe('fulfilled');
  });

  const completedJobsList: {
    job: CompletedContactJobBody;
    processCompletedFunction: keyof typeof contactJobComplete;
  }[] = [
    {
      job: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        attemptResult: ContactJobAttemptResult.SUCCESS,
        jobId: 1,
        accountSid: 'accountSid',
        contactId: 123,
        conversationMediaId: 999,
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        serviceSid: 'serviceSid',
        channelSid: 'channelSid',
        filePath: 'filePath',
        attemptNumber: 1,
        attemptPayload: {
          bucket: 'completionPayload',
          key: 'completionPayload',
        },
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

      jest
        .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
        .mockImplementation(async () => ({
          $metadata: {},
          Messages: [validPayload],
        }));
      const deletedCompletedContactJobsSpy = jest.spyOn(
        SQSClient,
        'deleteCompletedContactJobsFromQueue',
      );
      const processCompletedFunctionSpy = jest
        .spyOn(contactJobComplete, processCompletedFunction)
        .mockImplementation(async () => {});
      const completeContactJobSpy = jest
        .spyOn(contactJobDataAccess, 'completeContactJob')
        .mockImplementation(async () => validPayload as any);

      const result = await contactJobComplete.pollAndProcessCompletedContactJobs(
        JOB_MAX_ATTEMPTS,
      );

      expect(processCompletedFunctionSpy).toHaveBeenCalledWith(job);
      expect(completeContactJobSpy).toHaveBeenCalledWith({
        id: job.jobId,
        completionPayload: {
          message: 'Job processed successfully',
          value: job.attemptPayload,
        },
      });
      expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(
        validPayload.ReceiptHandle,
      );

      expect(result?.[0].status).toBe('fulfilled');
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
        attemptResult: ContactJobAttemptResult.FAILURE,
        jobId: 1,
        accountSid: 'accountSid',
        contactId: 123,
        conversationMediaId: 999,
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

      jest
        .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
        .mockImplementation(async () => ({
          $metadata: {},
          Messages: [validPayload],
        }));
      const deletedCompletedContactJobsSpy = jest.spyOn(
        SQSClient,
        'deleteCompletedContactJobsFromQueue',
      );
      const processCompletedFunctionSpy = jest
        .spyOn(contactJobComplete, processCompletedFunction)
        .mockImplementation(async () => {});
      const completeContactJobSpy = jest
        .spyOn(contactJobDataAccess, 'completeContactJob')
        .mockImplementation(async () => job);
      const appendFailedAttemptPayloadSpy = jest
        .spyOn(contactJobDataAccess, 'appendFailedAttemptPayload')
        .mockImplementation(() => job);

      const result = await contactJobComplete.pollAndProcessCompletedContactJobs(
        JOB_MAX_ATTEMPTS,
      );

      expect(processCompletedFunctionSpy).not.toHaveBeenCalled();
      expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(
        validPayload.ReceiptHandle,
      );

      if (expectMarkedAsComplete) {
        expect(completeContactJobSpy).toHaveBeenCalledWith({
          id: job.jobId,
          completionPayload: {
            message: 'Attempts limit reached',
          },
          wasSuccessful: false,
        });
      } else {
        expect(completeContactJobSpy).not.toHaveBeenCalled();
      }

      expect(appendFailedAttemptPayloadSpy).toHaveBeenCalledWith(
        job.jobId,
        job.attemptNumber,
        job.attemptPayload,
      );

      expect(result?.[0].status).toBe('fulfilled');
    },
  );

  describe('getAttemptNumber', () => {
    it('returns completedJob.attemptNumber when not null', async () => {
      const completedJob = {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        jobId: 1,
        accountSid: 'accountSid',
        attemptNumber: 1,
        contactId: 123,
        conversationMediaId: 999,
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        serviceSid: 'serviceSid',
        channelSid: 'channelSid',
        filePath: 'filePath',
        attemptPayload: {
          bucket: 'some-url-here',
          key: 'some-url-here',
        },
        attemptResult: ContactJobAttemptResult.FAILURE,
      };
      const contactJob = {
        id: 1,
        contactId: 123,
        // conversationMediaId: 999,
        accountSid: 'accountSid',
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        requested: new Date(),
        completed: null,
        lastAttempt: new Date(),
        numberOfAttempts: 1,
        additionalPayload: null,
        completionPayload: null,
      };

      const result = await contactJobComplete.getAttemptNumber(completedJob, contactJob);

      expect(result).toBe(completedJob.attemptNumber);
    });

    it('returns contactJob.numberOfAttempts when completedJob.attemptNumber is null', async () => {
      const completedJob = {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        jobId: 1,
        accountSid: 'accountSid',
        attemptNumber: undefined,
        contactId: 123,
        conversationMediaId: 999,
        taskId: 'taskId',
        twilioWorkerId: 'twilioWorkerId',
        serviceSid: 'serviceSid',
        channelSid: 'channelSid',
        filePath: 'filePath',
        attemptPayload: {
          bucket: 'some-url-here',
          key: 'some-url-here',
        },
        attemptResult: ContactJobAttemptResult.FAILURE,
      };

      const contactJob = {
        id: 1,
        contactId: 123,
        accountSid: 'accountSid',
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        requested: new Date(),
        completed: null,
        lastAttempt: new Date(),
        numberOfAttempts: 5,
        additionalPayload: null,
        completionPayload: null,
      };

      const result = await contactJobComplete.getAttemptNumber(completedJob, contactJob);

      expect(result).toBe(contactJob.numberOfAttempts);
    });
  });
});
