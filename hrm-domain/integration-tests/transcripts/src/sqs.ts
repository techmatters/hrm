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
