import { SQS } from 'aws-sdk';
import { getStackOutput } from './parseCdkOutput';

export const sendMessage = async ({
  lambdaName,
  message,
}: {
  lambdaName: string;
  message: object;
}) => {
  const sqs = new SQS({
    region: 'eu-west-1',
    endpoint: 'http://localstack:4566',
  });

  const lambdaOutput: any = getStackOutput(lambdaName);
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: lambdaOutput.queueUrl,
  };
  return sqs.sendMessage(params).promise();
};
