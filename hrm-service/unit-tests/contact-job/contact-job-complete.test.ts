import * as SQSClient from '../../src/contact-job/client-sqs';
import * as contactJobDataAccess from '../../src/contact-job/contact-job-data-access';
import * as contactJobComplete from '../../src/contact-job/contact-job-complete';
import { ContactJobType } from '../../src/contact-job/contact-job-data-access';

afterEach(() => {
  jest.clearAllMocks();
});

describe('pollAndprocessCompletedContactJobs', () => {
  test('Completed jobs are polled as expected', async () => {
    const sqsSpy = jest
      .spyOn(SQSClient, 'pollCompletedContactJobs')
      .mockImplementation(async () => ({
        Messages: [],
      }));

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs();

    expect(sqsSpy).toHaveBeenCalled();
    expect(Array.isArray(result)).toBeTruthy();
    expect(result.length).toBe(0);
  });

  test('Invalid job format throws but does not shuts down other jobs', async () => {
    const invalidPayload = {
      Body: JSON.stringify({ jobType: 'invalid' }),
      ReceiptHandle: 'invalid',
    };
    const validPayload = {
      Body: JSON.stringify({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      }),
      ReceiptHandle: 'valid',
    };

    jest.spyOn(SQSClient, 'pollCompletedContactJobs').mockImplementation(async () => ({
      Messages: [invalidPayload, validPayload],
    }));
    const errorSpy = jest.spyOn(console, 'error');
    const processCompletedRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
      .mockImplementation(async () => {});

    jest
      .spyOn(contactJobDataAccess, 'completeContactJob')
      .mockImplementation(async () => 'done' as any);

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs();

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
    const validPayload1 = {
      Body: JSON.stringify({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      }),
      ReceiptHandle: 'valid',
    };

    const validPayload2 = {
      Body: JSON.stringify({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      }),
      ReceiptHandle: 'valid',
    };

    jest.spyOn(SQSClient, 'pollCompletedContactJobs').mockImplementation(async () => ({
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

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs();

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

  test('RETRIEVE_CONTACT_TRANSCRIPT job is processed accordingly', async () => {
    const job = {
      jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
      jobId: 1,
      accountSid: 'accountSid',
      contactId: 'contactId',
      taskId: 'taskId',
      twilioWorkerId: 'twilioWorkerId',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
      filePath: 'filePath',
      completionPayload: 'completionPayload',
    };
    const validPayload = {
      Body: JSON.stringify(job),
      ReceiptHandle: 'valid',
    };

    jest.spyOn(SQSClient, 'pollCompletedContactJobs').mockImplementation(async () => ({
      Messages: [validPayload],
    }));
    const deletedCompletedContactJobsSpy = jest
      .spyOn(SQSClient, 'deletedCompletedContactJobs')
      .mockImplementation(async () => {});
    const processCompletedRetrieveContactTranscriptSpy = jest
      .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
      .mockImplementation(async () => {});
    const completeContactJobSpy = jest
      .spyOn(contactJobDataAccess, 'completeContactJob')
      .mockImplementation(async () => validPayload as any);

    const result = await contactJobComplete.pollAndprocessCompletedContactJobs();

    expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledWith(job);
    expect(completeContactJobSpy).toHaveBeenCalledWith(job.jobId, job.completionPayload);
    expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(validPayload.ReceiptHandle);

    expect(result[0].status).toBe('fulfilled');
  });
});
