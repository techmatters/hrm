// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord, SNSMessage } from 'aws-lambda';
import { ssmCache, loadSsmCache } from 'hrm-ssm-cache';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();

//TODO: remove this once I figure out how to do it in cdk config (rbd - 07/10/22)
const completedQueueUrl = process.env.completed_sqs_queue_url as string;
const hrm_env = process.env.hrm_env;

/**
 * Discussion Topic:
 * This assumes a new ssm param path based structure like `/development/twilio/${accountSid}/AUTH_TOKEN`,
 * Obviously accountSid could be a more simple representation of the account if needed. But I think this
 * would allow us to increase the flexibility of loading SSM params in batches significantly and for applying
 * IAM policies to SSM params in a slightly less granular way.
 *
 * I still don't have an understanding of all of the places and ways that the various credentials are used
 * and would love some input on this before we go too much further. (rbd - 06/10/22)
 */
const ssmCacheConfigs = [
  {
    path: `/${hrm_env}/twilio`,
    regex: /auth_token/,
  },
  {
    path: `/${hrm_env}/s3`,
    regex: /docs_bucket_name/,
  },
];

const processRecord = async (sqsRecord: SQSRecord) => {
  const message = JSON.parse(sqsRecord.body);
  console.log(message);

  const authToken = ssmCache.values[`/${hrm_env}/twilio/${message.accountSid}/auth_token`];
  const docsBucketName = ssmCache.values[`/${hrm_env}/s3/${message.accountSid}/docs_bucket_name`];

  if (!authToken || !docsBucketName) {
    throw new Error('Missing required SSM params');
  }

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

    if (!hrm_env) {
      throw new Error('Missing hrm_env ENV Variable');
    }

    await loadSsmCache({ configs: ssmCacheConfigs });

    const promises = event.Records.map(
      async (sqsRecord) => await processRecordWithoutException(sqsRecord),
    );

    await Promise.all(promises);

    return response;
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.dir(err);

    // We use batchItemFailures here because we d
    response.batchItemFailures = event.Records.map((record) => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
