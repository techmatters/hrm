// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord, SNSMessage } from 'aws-lambda';
import { exportTranscript } from './exportTranscript';
import { config, loadParameters } from 'hrm-ssm-cache';
import { uploadTranscript } from './uploadTranscript';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();
const completedQueueUrl = process.env.completed_sqs_queue_url;
const hrm_env = process.env.hrm_env;

const processRecord = async (sqsRecord: SQSRecord) => {
  console.dir(sqsRecord);
  /**
   * TODO: This is still based around sending messages with SNS instead of directly to SES. I think we should
   * consider moving to sending SES directly from HRM, as that will simplify the message structure. If we
   * were sending a generic "contactSaved" event to SNS and letting sns handle figuring out if it should
   * process a transcript or a recording based on the payload, the SNS message structure would seem more
   * worth the complexity. But if we know at job creation time that the job what type of job is being sent
   * and what jobs should run, we can just send the payload directly to SES and avoid the added SNS message
   * complexity.
   */
  const snsMessage: SNSMessage = JSON.parse(sqsRecord.body);
  const message = JSON.parse(snsMessage.Message);

  const authToken = config.values[`/${hrm_env}/${message.accountSid}/TWILIO_AUTH_TOKEN`];
  const docsBucketName = config.values[`/${hrm_env}/${message.accountSid}/S3_DOCS_BUCKET_NAME`];

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
  if (!completedQueueUrl) {
    throw new Error('Missing completed_sqs_queue_url ENV Variable');
  }

  if (!hrm_env) {
    throw new Error('Missing hrm_env ENV Variable');
  }

  // This isn't really doing anything if we are handling errors in the complete queue, but
  // it keeps us from having to delete each message from the queue since SQS will assume
  // success if we don't return anything in batchItemFailure response. And the queues
  // will be set up for more "SQS" native error handling in the future if we decide it
  // has value. (rbd - 03/10/22)
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    await loadParameters({ regex: /TWILIO_AUTH_TOKEN|S3_DOCS_BUCKET_NAME/ });

    const promises = event.Records.map(
      async (sqsRecord) => await processRecordWithoutException(sqsRecord),
    );

    await Promise.all(promises);

    return response;
  } catch (err) {
    //SSM failures and other uncaught exceptions will cause a failure of all messages sending them to DLQ.
    console.error(err);

    response.batchItemFailures = event.Records.map((record) => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
