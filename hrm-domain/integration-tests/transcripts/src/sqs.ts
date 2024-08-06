import { receiveSqsMessage } from '@tech-matters/sqs-client';

export const waitForSQSMessage = async (
  queueUrl: string,
  {
    retryCount = 0,
  }: {
    retryCount?: number;
  } = {},
): Promise<ReturnType<typeof receiveSqsMessage> | undefined> => {
  let result;
  try {
    result = await receiveSqsMessage({ queueUrl });
    if (!result?.Messages) throw new Error('No messages');
  } catch (err) {
    if (retryCount < 60) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return waitForSQSMessage(queueUrl, { retryCount: retryCount + 1 });
    }
  }

  return result;
};
