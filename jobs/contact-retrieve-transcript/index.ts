// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';

import { ContactJobProcessorError } from '@tech-matters/hrm-job-errors';
import { getSsmParameter, loadSsmCache } from '@tech-matters/hrm-ssm-cache';
import { exportTranscript } from './exportTranscript';
import { uploadTranscript } from './uploadTranscript';

// eslint-disable-next-line prettier/prettier
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
// eslint-disable-next-line prettier/prettier
import type {
  CompletedContactJobBody,
  PublishToContactJobsTopicParams,
} from '@tech-matters/hrm-types/ContactJob';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();

const completedQueueUrl = process.env.completed_sqs_queue_url as string;
const hrmEnv = process.env.NODE_ENV;

const ssmCacheConfigs = [
  {
    path: `/${hrmEnv}/twilio/`,
    regex: /auth_token/,
  },
  {
    path: `/${hrmEnv}/s3/`,
    regex: /docs_bucket_name/,
  },
];

const processRecord = async (message: PublishToContactJobsTopicParams) => {
  console.log(message);

  const authToken = getSsmParameter(`/${hrmEnv}/twilio/${message.accountSid}/auth_token`);
  const docsBucketName = getSsmParameter(`/${hrmEnv}/s3/${message.accountSid}/docs_bucket_name`);

  if (!authToken || !docsBucketName) {
    throw new Error('Missing required SSM params');
  }

  const transcript = await exportTranscript({
    authToken,
    accountSid: message.accountSid,
    channelSid: message.channelSid,
    serviceSid: message.serviceSid,
  });

  const uploadResults = await uploadTranscript({
    transcript,
    docsBucketName,
    accountSid: message.accountSid,
    contactId: message.contactId,
    filePath: message.filePath,
    taskId: message.taskId,
    twilioWorkerId: message.twilioWorkerId,
    serviceSid: message.serviceSid,
    channelSid: message.channelSid,
  });

  const completedJob: CompletedContactJobBody = {
    ...message,
    attemptResult: 'success',
    attemptPayload: uploadResults.Location,
  };

  await sqs
    .sendMessage({
      MessageBody: JSON.stringify(completedJob),
      QueueUrl: completedQueueUrl,
    })
    .promise();
};

export const processRecordWithoutException = async (sqsRecord: SQSRecord): Promise<void> => {
  const message = JSON.parse(sqsRecord.body);
  try {
    await processRecord(message);
  } catch (err) {
    console.error(new ContactJobProcessorError('Failed to process record'), err);

    const errMessage = err instanceof Error ? err.message : String(err);

    const failedJob: CompletedContactJobBody = {
      ...message,
      attemptResult: 'failure',
      attemptPayload: errMessage,
    };

    await sqs
      .sendMessage({
        MessageBody: JSON.stringify(failedJob),
        QueueUrl: completedQueueUrl,
      })
      .promise();
  }
};

export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    if (!completedQueueUrl) {
      throw new Error('Missing completed_sqs_queue_url ENV Variable');
    }

    if (!hrmEnv) {
      throw new Error('Missing NODE_ENV ENV Variable');
    }

    await loadSsmCache({ configs: ssmCacheConfigs });

    const promises = event.Records.map(async sqsRecord => processRecordWithoutException(sqsRecord));

    await Promise.all(promises);

    return response;
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.error(new ContactJobProcessorError('Failed to init processor'), err);

    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. The error
    // handler, whether loop based in hrm-services or lambda based here, will
    // need to be able to handle these messages that will end up in the completed
    // queue without a completionPayload.
    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
