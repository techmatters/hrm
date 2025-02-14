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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import * as SQSClient from '../../contact-job/client-sqs';
import * as contactJobPublish from '../../contact-job/contact-job-publish';
import { ContactJob } from '../../contact-job/contact-job-data-access';
import { ContactJobType } from '@tech-matters/types';
import each from 'jest-each';
import { PublishToContactJobsTopicParams } from '@tech-matters/types';

jest.mock('../../contact-job/client-sqs');

jest.mock('@tech-matters/ssm-cache', () => {
  return {
    getSsmParameter: jest.fn(),
  };
});

const accountSid = 'AC-accountSid';
const twilioWorkerId = 'WK-twilioWorkerId';
const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
>;

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSsmParameter.mockResolvedValue('true');
});

describe('publishDueContactJobs', () => {
  test('Invalid job format throws but does not shuts down other jobs', async () => {
    const invalidPayload = { jobType: 'invalid' };
    const validPayload: PublishToContactJobsTopicParams = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid,
      attemptNumber: 1,
      contactId: 123,
      conversationMediaId: 999,
      taskId: 'taskId',
      twilioWorkerId,
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
      new Error(`Unhandled case: ${invalidPayload}`),
      invalidPayload,
    );

    expect(result[0].status).toBe('rejected');
    expect(result[1].status).toBe('fulfilled');

    publishRetrieveContactTranscriptSpy.mockRestore();
  });

  test('If a job fails, it does not shuts down other jobs', async () => {
    const validPayload1 = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid,
      attemptNumber: 1,
      contactId: 123,
      taskId: 'taskId',
      twilioWorkerId,
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
    };

    const validPayload2 = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 2,
      accountSid,
      attemptNumber: 1,
      contactId: 321,
      taskId: 'taskId',
      twilioWorkerId,
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
    expect(errorSpy).toHaveBeenCalledWith(new Error(':sad_trombone:'), validPayload1);

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
        additionalPayload: {
          conversationMediaId: 999,
        },
        accountSid,
        contactId: 123,
        lastAttempt: null,
        numberOfAttempts: 1,
        requested: new Date().toISOString(),
        resource: {
          accountSid,
          id: 123,
          taskId: 'taskId',
          twilioWorkerId,
          serviceSid: 'serviceSid',
          channelSid: 'channelSid',
          createdAt: new Date('01-01-2022').toISOString(),
          csamReports: [],
        },
      },
      publishDueContactJobFunction: 'publishRetrieveContactTranscript',
      expectedMessageToPublish: {
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        jobId: 1,
        contactId: 123,
        conversationMediaId: 999,
        accountSid,
        channelSid: 'channelSid',
        serviceSid: 'serviceSid',
        taskId: 'taskId',
        twilioWorkerId,
        filePath: 'transcripts/2022/01/01/20220101000000-taskId.json',
        attemptNumber: 1,
      },
    },
    {
      dueJob: {
        jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
        id: 1,
        completed: null,
        completionPayload: null,
        additionalPayload: {
          originalLocation: {
            bucket: 'bucket',
            key: 'key',
          },
        },
        accountSid,
        contactId: 123,
        lastAttempt: null,
        numberOfAttempts: 1,
        requested: new Date().toISOString(),
        resource: {
          accountSid,
          id: 123,
          taskId: 'taskId',
          twilioWorkerId,
          serviceSid: 'serviceSid',
          channelSid: 'channelSid',
          createdAt: new Date('01-01-2022').toISOString(),
          csamReports: [],
        },
      },
      publishDueContactJobFunction: 'publishScrubTranscriptJob',
      expectedMessageToPublish: {
        jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
        jobId: 1,
        contactId: 123,
        originalLocation: {
          bucket: 'bucket',
          key: 'key',
        },
        accountSid,
        taskId: 'taskId',
        twilioWorkerId,
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
        .spyOn(SQSClient, 'publishToContactJobs')
        .mockImplementation(() => Promise.resolve(undefined));
      const publishDueContactJobFunctionSpy = jest.spyOn(
        contactJobPublish,
        publishDueContactJobFunction,
      );

      const result = await contactJobPublish.publishDueContactJobs([dueJob]);

      expect(publishDueContactJobFunctionSpy).toHaveBeenCalledWith(dueJob);
      expect(publishToContactJobsTopicSpy).toHaveBeenCalledWith(expectedMessageToPublish);

      expect(result[0].status).toBe('fulfilled');
    },
  );
});
