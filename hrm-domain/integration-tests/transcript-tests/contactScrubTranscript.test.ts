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
import { getS3Object } from '@tech-matters/s3-client';
import { purgeSqsQueue, receiveSqsMessage } from '@tech-matters/sqs-client';
import { generateMockMessageBody } from 'support/generateMockMessageBody';
import { getStackOutput } from '../../../cdk/cdkOutput';
import { sendMessage } from '../../../test-support/sendMessage';

/**
 * TODO: This is a super dirty proof of concept for e2e tests.
 * It needs cleanup.
 */

jest.setTimeout(60000);

const completeOutput: any = getStackOutput('contact-complete');
const { queueUrl } = completeOutput;

// const lambdaName = 'retrieve-transcript';

export const waitForS3Object = async ({
  message,
  retryCount = 0,
}: {
  message: ReturnType<typeof generateMockMessageBody>;
  retryCount?: number;
}): Promise<ReturnType<typeof getS3Object> | undefined> => {
  const params = {
    bucket: 'docs-bucket',
    key: message.filePath,
  };

  let result;
  try {
    result = await getS3Object(params);
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
} = {}): Promise<ReturnType<typeof receiveSqsMessage> | undefined> => {
  let result;
  try {
    result = await receiveSqsMessage({ queueUrl });
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
    await purgeSqsQueue({ queueUrl });
  });

  test('well formed message creates success message in complete queue and file in s3', async () => {
    const message = generateMockMessageBody();
    const attemptPayload = {
      bucket: 'docs-bucket',
      key: message.filePath,
    };

    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const s3Result = await waitForS3Object({ message });
    expect(s3Result).toBeDefined();
    expect(JSON.parse(s3Result!)).toHaveProperty('contactId');

    const sqsResult = await waitForSQSMessage();
    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];
    const body = JSON.parse(sqsMessage?.Body || '');
    expect(body?.attemptResult).toEqual('success');
    expect(body?.attemptPayload).toEqual(attemptPayload);
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
    expect(body?.attemptPayload).toEqual(
      'Parameter /local/twilio/badSid/auth_token not found.',
    );
  });
});
