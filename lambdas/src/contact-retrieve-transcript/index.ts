// eslint-disable-next-line import/no-extraneous-dependencies
import { S3 } from 'aws-sdk';
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord, SNSMessage } from 'aws-lambda';
import { exportTranscript } from './exportTranscript';
import { getParameters } from './getParameters';
import { uploadTranscript } from './uploadTranscript';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();
const CompletedQueueUrl = process.env.completed_sqs_queue_url;

if (!CompletedQueueUrl) {
  throw new Error('Missing completed_sqs_queue_url ENV Variable');
}

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
  const parameters = await getParameters(message);

  const transcript = await exportTranscript({
    accountSid: message.accountSid,
    authToken: parameters.authToken,
    channelSid: message.channelSid,
    serviceSid: message.serviceSid,
  });

  const uploadResults: S3.ManagedUpload.SendData = await uploadTranscript({
    transcript,
    docsBucketName: parameters.docsBucketName,
    accountSid: message.accountSid,
    contactId: message.contactId,
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
      QueueUrl: CompletedQueueUrl,
    })
    .promise();
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
  try {
    // This isn't really doing anything if we are handling errors in the complete queue, but
    // it keeps us from having to delete each message from the queue since SQS will assume
    // success if we don't return anything in batchItemFailure response. And the queues
    // will be set up for more "SQS" native error handling in the future if we decide it
    // has value. (rbd - 03/10/22)
    const response: SQSBatchResponse = { batchItemFailures: [] };

    const promises = event.Records.map(async (sqsRecord: SQSRecord) => {
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
            QueueUrl: CompletedQueueUrl,
          })
          .promise();
      }
    });

    await Promise.all(promises);

    return response;
  } catch (err) {
    // You should REALLY never get here unless something is terribly wrong with the message from SQS
    // eslint-disable-next-line no-console
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(err),
    };
  }
};
