import { SQS } from 'aws-sdk';
import cdkOutput from '../cdk/outputs.json';

const lambdaName: string = process.argv[2];

const getMessage = async () => {
  const generator = await import(`../src/${lambdaName}/tests/generateMockMessageBody`);
  return generator.generateMessage();
};

const sendMessage = async () => {
  const message = await getMessage();

  const sqs = new SQS({
    region: 'eu-west-1',
    endpoint: 'http://localstack:4566',
  });

  const lambdaOutput: any = cdkOutput[lambdaName as keyof typeof cdkOutput];
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: lambdaOutput.queueUrl,
  };
  const resp = await sqs.sendMessage(params).promise();
  console.dir(resp);
};

sendMessage();
