// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { ssmCache, loadSsmCache } from 'hrm-ssm-cache';
import { exportTranscript } from './exportTranscript';
import { uploadTranscript } from './uploadTranscript';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();

const completedQueueUrl = process.env.completed_sqs_queue_url as string;
const hrmEnv = process.env.hrm_env;

/**
 * Discussion Topic:
 * This assumes a new ssm param path based structure like `/development/twilio/${accountSid}/AUTH_TOKEN`,
 * Obviously accountSid could be a more simple representation of the account if needed. But I think this
 * would allow us to increase the flexibility of loading SSM params in batches significantly and for applying
 * IAM policies to SSM params in a slightly less granular way.
 *
 * I still don't have an understanding of all of the places and ways that the various credentials are used
 * and would love some input on this before we go too much further. (rbd - 06/10/22)
 *
 * This structure could also have a region based permission boundary like:
 * `/development/us-east-1/twilio/${accountSid}/AUTH_TOKEN` so that lambdas and hrm in us-east-1 would only
 * have access to and load secrets for their region. (rbd 12/10/22)
 */
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

  const completedJob = {
    ...message,
    completionPayload: uploadResults.Location,
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

    // TODO: fill this in appropriately once some other decisions have been made. (rbd - 03/10/22)
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

/**
 * I refactored this from the multiple Promises.allSettled() that depended on input chaining approach to
 * a single map with a Promise.all() where all errors are swallowed by exceptions and added to a
 * SQSBatchResponse so we can use built-in error handling in SQS/Lambda. For me, this pattern is
 * significantly simpler and easier to understand, but I know that is a subjective opinion and am
 * happy to explore options around the nested bach operations approach if that is preferred.
 * (rbd - 01/10/22)
 */
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
