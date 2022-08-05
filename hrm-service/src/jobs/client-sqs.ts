import {
  SQSClient,
  ReceiveMessageCommand,
  ReceiveMessageCommandInput,
  DeleteMessageCommand,
  DeleteMessageCommandInput,
} from '@aws-sdk/client-sqs';

const client = new SQSClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

export const pollCompletedJobs = async () => {
  const command: ReceiveMessageCommandInput = {
    QueueUrl: process.env.COMPLETED_JOBS_QUEUE_URL,
  };

  const data = await client.send(new ReceiveMessageCommand(command));

  return data;
};

export const deletedCompletedJobs = async (
  ReceiptHandle: DeleteMessageCommandInput['ReceiptHandle'],
) => {
  const command: DeleteMessageCommandInput = {
    QueueUrl: process.env.COMPLETED_JOBS_QUEUE_URL,
    ReceiptHandle,
  };

  const data = await client.send(new DeleteMessageCommand(command));

  return data;
};
