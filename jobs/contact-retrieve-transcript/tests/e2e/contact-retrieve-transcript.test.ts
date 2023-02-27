/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { S3, SQS } from 'aws-sdk';
import { generateMockMessageBody } from '../generateMockMessageBody';
import { getStackOutput } from '../../../../cdk/cdkOutput';
import { sendMessage } from '../../../tests/sendMessage';

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
  endpoint: localstackEndpoint,
});

const lambdaName = 'retrieve-transcript';

export const waitForS3Object = async ({
  message,
  retryCount = 0,
}: {
  message: ReturnType<typeof generateMockMessageBody>;
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
    if (retryCount < 60) {
      await new Promise(resolve => setTimeout(resolve, 250));
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
    if (retryCount < 60) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return waitForSQSMessage({ retryCount: retryCount + 1 });
    }
  }

  return result;
};

describe('contact-retrieve-transcript', () => {
  beforeEach(async () => {
    await sqs.purgeQueue({ QueueUrl: queueUrl }).promise();
  });

  test('well formed message creates success message in complete queue and file in s3', async () => {
    const message = generateMockMessageBody();

    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const s3Result = await waitForS3Object({ message });
    expect(s3Result).toHaveProperty('Body');

    const sqsResult = await waitForSQSMessage();
    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];
    const body = JSON.parse(sqsMessage?.Body || '');
    expect(body?.attemptResult).toEqual('success');
    expect(body?.attemptPayload).toEqual(
      `http://localstack:4566/contact-docs-bucket/${message.filePath}`,
    );
  });

  test('message with bad accountSid produces failure message in complete queue', async () => {
    const message = { ...generateMockMessageBody(), accountSid: 'badSid' };
    const sqsResp = await sendMessage({ message, lambdaName });

    expect(sqsResp).toHaveProperty('MessageId');

    const sqsResult = await waitForSQSMessage();
    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];
    const body = JSON.parse(sqsMessage?.Body || '');
    expect(body?.attemptResult).toEqual('failure');
    expect(body?.attemptPayload).toEqual('Parameter /local/twilio/badSid/auth_token not found.');
  });
});
