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

import { SQS } from 'aws-sdk';

import {
  createIndex,
  deleteIndex,
  getClient,
  refreshIndex,
  search,
} from '@tech-matters/elasticsearch-client';

import { SearchResults } from '@tech-matters/types';

import { generateMockMessageBody } from '../generateMockMessageBody';
import { getStackOutput } from '../../../../cdk/cdkOutput';
import { sendMessage } from '../../../tests/sendMessage';

/**
 * TODO: This is a super dirty proof of concept for e2e tests.
 * It needs cleanup.
 */

jest.setTimeout(60000);

const localstackEndpoint = 'http://localhost:4566';
const accountSids = ['ACCOUNT_1', 'ACCOUNT_2'];
const indexType = 'resources';
const lambdaName = 'resources-search-index';
const completeOutput: any = getStackOutput('resources-search-complete');
const { errorQueueUrl } = completeOutput;

const sqs = new SQS({
  endpoint: localstackEndpoint,
});

export const waitForSearchResults = async ({
  message,
  retryCount = 0,
}: {
  message: ReturnType<typeof generateMockMessageBody>;
  retryCount?: number;
}): Promise<SearchResults | undefined> => {
  await refreshIndex({
    accountSid: message.accountSid,
    indexType,
  });

  const result = await search({
    accountSid: message.accountSid,
    indexType,
    searchParameters: {
      q: message.document.attributes[0].value,
      pagination: {
        limit: 10,
        start: 0,
      },
    },
  });

  if (result.total === 0 && retryCount < 60) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return waitForSearchResults({ message, retryCount: retryCount + 1 });
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
    result = await sqs.receiveMessage({ QueueUrl: errorQueueUrl }).promise();
    if (!result?.Messages) throw new Error('No messages');
  } catch (err) {
    if (retryCount < 200) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return waitForSQSMessage({ retryCount: retryCount + 1 });
    }
  }

  return result;
};

describe('resources-search-index', () => {
  beforeEach(async () => {
    await sqs.purgeQueue({ QueueUrl: errorQueueUrl }).promise();
    await Promise.all(
      accountSids.map(async accountSid => {
        // This is a bit of a hack to get the client to connect to the localstack instance on localhost
        // instead of using the localstack ssm parameter which points to the internal docker network
        // address of the elasticsearch container: http://elasticsearch:9200
        await getClient({
          accountSid: accountSid,
          config: {
            node: 'http://localhost:9200',
          },
        });
        await createIndex({
          accountSid,
          indexType,
        });
      }),
    );
  });

  afterEach(async () => {
    await Promise.all(
      accountSids.map(async accountSid => {
        await deleteIndex({
          accountSid,
          indexType,
        });
      }),
    );

    await sqs.purgeQueue({ QueueUrl: errorQueueUrl }).promise();
  });

  test('well formed message results in indexed document', async () => {
    const message = generateMockMessageBody();
    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    const searchResult = await waitForSearchResults({ message });
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('items');
    expect(searchResult?.total).toEqual(1);
    expect(searchResult?.items).toHaveLength(1);
    expect(searchResult?.items[0]).toHaveProperty('id');
    expect(searchResult?.items[0].id).toEqual(message.document.id);
  });

  test('message with bad accountSid produces failure message in complete queue', async () => {
    const message = { ...generateMockMessageBody(), accountSid: 'badSid' };
    const sqsResp = await sendMessage({ message, lambdaName });
    expect(sqsResp).toHaveProperty('MessageId');

    // For now the localstack SNS topic sends the message to an error queue
    // instead of email so we can test it here.
    const sqsResult = await waitForSQSMessage();

    expect(sqsResult).toBeDefined();
    expect(sqsResult).toHaveProperty('Messages');
    expect(sqsResult?.Messages).toHaveLength(1);

    const sqsMessage = sqsResult?.Messages?.[0];
    const body = JSON.parse(sqsMessage?.Body || '');
    const errorMessage = JSON.parse(body?.Message || '');
    expect(errorMessage).toMatchObject(message);
  });
});
