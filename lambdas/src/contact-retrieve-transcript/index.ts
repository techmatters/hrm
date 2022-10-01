// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord, SNSMessage } from 'aws-lambda';
import { exportTranscript } from './exportTranscript';
import { getParameters } from './getParameters';
import { uploadTranscript } from './uploadTranscript';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 * Reference: https://dev.to/aws-builders/amazon-sqs-to-aws-lambda-error-handling-3d4f
 */

const sqs = new SQS();
const sqsQueueUrl = process.env.completed_sqs_queue_url;

if (!sqsQueueUrl) {
  throw new Error('Missing sqsQueueUrl');
}

const processRecord = async (sqsRecord: SQSRecord) => {
  const snsMessage: SNSMessage = JSON.parse(sqsRecord.body);
  const message = JSON.parse(snsMessage.Message);
  const parameters = await getParameters(message);

  //TODO: this is pretty goofy. refactor inputs to take partial types
  const { accountSid, channelSid, contactId, serviceSid, taskId, twilioWorkerId } = message;
  const { authToken, docsBucketName } = parameters;

  const transcript = await exportTranscript({
    accountSid,
    authToken,
    channelSid,
    serviceSid,
  });

  const uploadResults = await uploadTranscript({
    transcript,
    docsBucketName,
    accountSid,
    contactId,
    taskId,
    twilioWorkerId,
    serviceSid,
    channelSid,
  });

  const completedJob = {
    ...message,
    completionPayload: uploadResults.Location,
  };

  await sqs
    .sendMessage({
      MessageBody: JSON.stringify(completedJob),
      QueueUrl: sqsQueueUrl,
    })
    .promise();
};

export const handler = async (event: SQSEvent): Promise<any> => {
  try {
    const response: SQSBatchResponse = { batchItemFailures: [] };

    const promises = event.Records.map(async (sqsRecord: SQSRecord) => {
      try {
        await processRecord(sqsRecord);
      } catch (err) {
        console.log('Failed to process record', err);

        /**
         * This is currently based around using built in retry and DLQs to handle
         * failed messages.
         */
        response.batchItemFailures.push({ itemIdentifier: sqsRecord.messageId });
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
