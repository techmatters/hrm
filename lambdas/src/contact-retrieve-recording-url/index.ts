// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { ssmCache, loadSsmCache } from 'hrm-ssm-cache';

//TODO: this is a placeholder for recording retrieval that doesn't actually do anything yet.

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();

const completedQueueUrl = process.env.completed_sqs_queue_url as string;
const hrmEnv = process.env.hrm_env;

const ssmCacheConfigs = [
  {
    path: `/${hrmEnv}/twilio`,
    regex: /auth_token/,
  },
  {
    path: `/${hrmEnv}/s3`,
    regex: /docs_bucket_name/,
  },
];

const processRecord = async (sqsRecord: SQSRecord) => {
  const message = JSON.parse(sqsRecord.body);
  console.log(message);

  const authToken = ssmCache.values[`/${hrmEnv}/twilio/${message.accountSid}/auth_token`];
  const docsBucketName = ssmCache.values[`/${hrmEnv}/s3/${message.accountSid}/docs_bucket_name`];

  if (!authToken || !docsBucketName) {
    throw new Error('Missing required SSM params');
  }

  // TODO: fill in the actual work!

  const completedJob = {
    ...message,
    completionPayload: 'notARealPayload',
  };

  await sqs
    .sendMessage({
      MessageBody: JSON.stringify(completedJob),
      QueueUrl: completedQueueUrl,
    })
    .promise();
};

export const processRecordWithoutException = async (sqsRecord: SQSRecord): Promise<void> => {
  try {
    await processRecord(sqsRecord);
  } catch (err) {
    console.error('Failed to process record', err);

    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';

    const failedJob = {
      error: {
        message,
        stack,
      },
      sqsRecord,
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
      throw new Error('Missing hrm_env ENV Variable');
    }

    await loadSsmCache({ configs: ssmCacheConfigs });

    const promises = event.Records.map(async (sqsRecord) =>
      processRecordWithoutException(sqsRecord),
    );

    await Promise.all(promises);

    return response;
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.dir(err);

    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. The error
    // handler, whether loop based in hrm-services or lambda based here, will
    // need to be able to handle these messages that will end up in the completed
    // queue without a completionPayload.
    response.batchItemFailures = event.Records.map((record) => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
