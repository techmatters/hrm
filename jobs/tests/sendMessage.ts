import { SQS } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import { getStackOutput } from '../../cdk/cdkOutput';

export const sendMessage = async ({
  lambdaName,
  message,
}: {
  lambdaName: string;
  message: object;
}) => {
  const sqs = new SQS({
    endpoint: 'http://localstack:4566',
  });

  const lambdaOutput: any = getStackOutput(lambdaName);
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: lambdaOutput.queueUrl,
  };
  return sqs.sendMessage(params).promise();
};
