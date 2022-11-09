import { SQS } from 'aws-sdk';
import { getSsmParameter } from '../config/ssmCache';

// eslint-disable-next-line prettier/prettier
import type { PublishToContactJobsTopicParams } from '@tech-matters/hrm-types/ContactJob';

let sqs: SQS;

export const getSqsClient = () => {
  if (!sqs) {
    sqs = new SQS();
  }
  return sqs;
};

export const pollCompletedContactJobsFromQueue =
  async (): Promise<SQS.Types.ReceiveMessageResult> => {
    try {
      const QueueUrl = getSsmParameter(
        `/${process.env.NODE_ENV}/sqs/jobs/contact/queue-url-contact-complete`,
      );

      return await getSqsClient()
        .receiveMessage({
          QueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
        })
        .promise();
    } catch (err) {
      console.error('Error trying to poll messages from SQS queue', err);
    }
  };

export const deleteCompletedContactJobsFromQueue = async (ReceiptHandle: string) => {
  try {
    const QueueUrl = getSsmParameter(
      `/${process.env.NODE_ENV}/sqs/jobs/contact/queue-url-contact-complete`,
    );

    return await getSqsClient().deleteMessage({ QueueUrl, ReceiptHandle }).promise();
  } catch (err) {
    console.error('Error trying to delete message from SQS queue', err);
  }
};

export const publishToContactJobs = async (params: PublishToContactJobsTopicParams) => {

  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = getSsmParameter(
      `/${process.env.NODE_ENV}/sqs/jobs/contact/queue-url-contact-${params.jobType}`,
    );

    return await getSqsClient()
      .sendMessage({
        MessageBody: JSON.stringify(params),
        QueueUrl,
      })
      .promise();
  } catch (err) {
    console.error('Error trying to send message to SQS queue', err);
  }
};
