// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord, SNSMessage } from 'aws-lambda';
import { exportTranscript } from './exportTranscript';
import { ssmCache, loadSsmCache } from 'hrm-ssm-cache';
import { uploadTranscript } from './uploadTranscript';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();
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
    regex: /AUTH_TOKEN/,
  },
  {
    path: `/${hrm_env}/s3`,
    regex: /DOCS_BUCKET_NAME/,
  },
];

const processRecord = async (sqsRecord: SQSRecord) => {
  console.dir(sqsRecord);
  /**
   * TODO: This is still based around sending messages with SNS instead of directly to SES. I think we should
   * consider moving to sending SES directly from HRM, as that will simplify the message structure. And simplify
   * processing of the DLQ if we are planning to use the completed queue as the DLQ in the first iteration. If we
   * were sending a generic "contactSaved" event to SNS and letting sns handle figuring out if it should
   * process a transcript or a recording based on the payload, the SNS message structure would seem more
   * worth the complexity. But if we know at job creation time that the job what type of job is being sent
   * and what jobs should run, we can just send the payload directly to SES and avoid the added SNS message
   * complexity.
   */
  const snsMessage: SNSMessage = JSON.parse(sqsRecord.body);
  const message = JSON.parse(snsMessage.Message);

  const authToken = ssmCache.values[`/${hrm_env}/twilio/${message.accountSid}/AUTH_TOKEN`];
  const docsBucketName = ssmCache.values[`/${hrm_env}/s3/${message.accountSid}/DOCS_BUCKET_NAME`];

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

    const failedJob = {
      //TODO: fill this in appropriately once some other decisions have been made. (rbd - 03/10/22)
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
    console.error(err);

    // We use batchItemFailures here because we d
    response.batchItemFailures = event.Records.map((record) => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
