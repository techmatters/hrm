import { SQS } from 'aws-sdk';
import output from './cdk/outputs.json';
import message from './src/contact-retrieve-transcript/testPayload.js';

const sqs = new SQS({
  region: 'eu-west-1',
  endpoint: 'http://localstack:4566',
});

console.dir(output);
console.dir(message);
sqs
  .sendMessage({
    MessageBody: JSON.stringify(message),
    QueueUrl: output[`contact-retrieve-transcript`].queueUrl,
  })
  .promise();
