import { getQueueAttributes, receiveSqsMessage } from '@tech-matters/sqs-client';
import { retryable } from './retryable';

export const waitForSQSMessage = retryable<
  { queueUrl: string },
  Awaited<ReturnType<typeof receiveSqsMessage>> | undefined
>(async ({ queueUrl }) => {
  const result = await receiveSqsMessage({ queueUrl });
  if (!result?.Messages) throw new Error('No messages');
  return result;
});

export const waitForExpectedNumberOfSQSMessage = retryable<
  { queueUrl: string; expectedNumberOfMessages: number },
  boolean
>(async ({ queueUrl, expectedNumberOfMessages }) => {
  const result = await getQueueAttributes({
    queueUrl,
    attributes: ['ApproximateNumberOfMessages'],
  });
  const actualNumberOfMessages = parseInt(result.ApproximateNumberOfMessages);
  if (actualNumberOfMessages !== expectedNumberOfMessages)
    throw new Error(
      `Expected ${expectedNumberOfMessages} messages, but got ${actualNumberOfMessages}`,
    );
  return true;
}, false);

