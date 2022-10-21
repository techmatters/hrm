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

export const pollCompletedContactJobsFromQueue = async (): Promise<{
  Messages: { ReceiptHandle: string; Body: string }[];
}> => {
  return {
    Messages: [],
  };
};

export const deleteCompletedContactJobsFromQueue = async (ReceiptHandle: any) => {
  return ReceiptHandle;
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
    console.error('Error trying to send message to SQS queue');
  }
};
