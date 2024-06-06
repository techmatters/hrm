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

import sqslite from 'sqslite';
import { SQS } from 'aws-sdk';
import { Mockttp } from 'mockttp';
import { mockSsmParameters } from './mockSsm';

export const newSQSmock = ({
  mockttp,
  pathPattern,
}: {
  mockttp: Mockttp;
  pathPattern: RegExp;
}) => {
  const sqsService = sqslite({});
  const sqsClient = new SQS({
    endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
  });

  let mockSQSQueueUrl: URL;

  const initializeSQSMock = async () => {
    await sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) });
    await mockSsmParameters(mockttp, [
      {
        pathPattern,
        // /\/(test|local|development)\/xx-fake-1\/sqs\/jobs\/hrm-resources-search\/queue-url-index/,
        valueGenerator: () => mockSQSQueueUrl.toString(),
      },
    ]);
  };

  const teardownSQSMock = async () => {
    await sqsService.close();
  };

  const createSQSMockQueue = async ({ queueName }: { queueName: string }) => {
    const { QueueUrl } = await sqsClient
      .createQueue({
        QueueName: queueName,
      })
      .promise();
    mockSQSQueueUrl = new URL(QueueUrl!);
  };

  const drestoySQSMockQueue = async ({ queueUrl }: { queueUrl: URL }) => {
    await sqsClient
      .deleteQueue({
        QueueUrl: queueUrl.toString(),
      })
      .promise();
  };

  const getMockSQSQueueUrl = () => mockSQSQueueUrl;

  return {
    initializeSQSMock,
    teardownSQSMock,
    createSQSMockQueue,
    drestoySQSMockQueue,
    getMockSQSQueueUrl,
  };
};
