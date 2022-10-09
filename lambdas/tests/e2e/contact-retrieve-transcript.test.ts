import { jest } from '@jest/globals';
import { S3, SSM } from 'aws-sdk';
import { sendMessage } from '../sendMessage';

jest.setTimeout(60000);

//TODO: modularize all of this setup for reuse
const s3 = new S3({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  s3ForcePathStyle: true,
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
    if (retryCount < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return waitForS3Object({ message, retryCount: retryCount + 1 });
    }
  }

  return result;
};

describe('contact-retrieve-transcript', () => {
  test('sendGoodMessage', async () => {
    const message = generateMessage();
    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const s3Result = await waitForS3Object({ message });
    expect(s3Result).toHaveProperty('Body');
  });
});
