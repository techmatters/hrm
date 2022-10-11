import { jest } from '@jest/globals';
import { S3, SQS } from 'aws-sdk';
import { getStackOutput } from '../parseCdkOutput';
import { sendMessage } from '../sendMessage';

/**
 * TODO: This is a super dirty proof of concept for e2e tests.
 * It needs cleanup.
 */

jest.setTimeout(60000);

const localstackEndpoint = 'http://localhost:4566';

const completeOutput: any = getStackOutput('contact-complete');
const { queueUrl } = completeOutput;

// TODO: modularize all of this setup for reuse
const s3 = new S3({
  region: 'us-east-1',
  endpoint: localstackEndpoint,
  s3ForcePathStyle: true,
});

const sqs = new SQS({
  region: 'eu-west-1',
});

const lambdaName = 'contact-retrieve-transcript';

const accountSids = ['testSid1', 'testSid2'];

export const generateMessage = () => {
  const accountSid = accountSids[Math.floor(Math.random() * accountSids.length)];
  return {
    jobId: Math.floor(Math.random() * 1000000),
    accountSid,
    contactId: Math.floor(Math.random() * 1000000),
    jobType: 'retrieve-contact-transcript',
    filePath: `accountSid/testFilePath-${Math.floor(Math.random() * 1000000)}`,
  };
};

export const waitForS3Object = async ({
  message,
  retryCount = 0,
}: {
  message: ReturnType<typeof generateMessage>;
  retryCount?: number;
}): Promise<S3.GetObjectOutput | undefined> => {
  const params = {
    Bucket: 'contact-docs-bucket',
    Key: message.filePath,
  };

  let result;
  try {
    result = await s3.getObject(params).promise();
  } catch (err) {
    if (retryCount < 15) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return waitForS3Object({ message, retryCount: retryCount + 1 });
    }
  }

  return result;
};

export const waitForSQSMessage = async ({
  retryCount = 0,
}: {
  retryCount?: number;
} = {}): Promise<SQS.ReceiveMessageResult | undefined> => {
  let result;
  try {
    result = await sqs.receiveMessage({ QueueUrl: queueUrl }).promise();
    if (!result?.Messages) throw new Error('No messages');
  } catch (err) {
    if (retryCount < 15) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return waitForSQSMessage({ retryCount: retryCount + 1 });
    }
  }

  return result;
};

describe('contact-retrieve-transcript', () => {
  beforeEach(async () => {
    await sqs.purgeQueue({ QueueUrl: queueUrl }).promise();
  });

  test('success', async () => {
    const message = generateMessage();
    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const s3Result = await waitForS3Object({ message });
    expect(s3Result).toHaveProperty('Body');

    const sqsResult = await waitForSQSMessage();
    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];

    const body = JSON.parse(sqsResult?.Messages?.[0]?.Body || '');
    expect(body?.completionPayload).toEqual(
      `http://localstack:4566/contact-docs-bucket/${message.filePath}`,
    );
  });

  test('badAccountSid', async () => {
    const message = { ...generateMessage(), accountSid: 'badSid' };
    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const sqsResult = await waitForSQSMessage();
    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];

    const body = JSON.parse(sqsResult?.Messages?.[0]?.Body || '');
    expect(body?.error.message).toEqual('Missing required SSM params');
  });
});
