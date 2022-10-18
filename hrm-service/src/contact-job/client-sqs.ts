import { SQS, SSM } from 'aws-sdk';
import { PublishToContactJobsTopicParams } from '@tech-matters/hrm-types/ContactJob';
import { getSsmParameter } from '../config/ssmCache';

const sqs = new SQS();

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

    return sqs
      .sendMessage({
        MessageBody: JSON.stringify(params),
        QueueUrl,
      })
      .promise();
  } catch (err) {
    console.error('Error trying to send message to SQS queue');
  }
};
