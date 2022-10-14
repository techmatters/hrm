import { SQS, SSM } from 'aws-sdk';
import { PublishToContactJobsTopicParams } from './contact-job-messages';

const sqs = new SQS();
// This allows endpoint override for localstack I haven't found a better way to do this globally yet
const ssmConfig = process.env.SSM_ENDPOINT ? { endpoint: process.env.SSM_ENDPOINT } : {};
const ssm = new SSM(ssmConfig);

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
  try {
    return sqs
      .sendMessage({
        MessageBody: JSON.stringify(params),
        QueueUrl: `lambdaOutput.queueUrl`,
      })
      .promise();
  } catch (err) {
    console.error('Error trying to send message to SQS queue', err);
  }
};
