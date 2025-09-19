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

import { purgeSqsQueue, receiveSqsMessage } from '@tech-matters/sqs-client';

import {
  Client,
  getClient,
  IndexClient,
  SearchResponse,
} from '@tech-matters/elasticsearch-client';
import type { FlatResource } from '@tech-matters/resources-types/Resources';

import {
  RESOURCE_INDEX_TYPE,
  resourceSearchConfiguration,
  resourceIndexConfiguration,
} from '@tech-matters/resources-search-config';

import { generateMockMessageBody } from '../generateMockMessageBody';
import { getStackOutput } from '../../../../../cdk/cdkOutput';
import { sendMessage, sendMessageBatch } from '../../../../../test-support/sendMessage';

/**
 * TODO: This is a super dirty proof of concept for integration tests.
 * It needs cleanup.
 */

jest.setTimeout(60000);

const accountSids = ['ACCOUNT_1', 'ACCOUNT_2'];
const indexType = RESOURCE_INDEX_TYPE;

const lambdaName = 'search-index';
const completeOutput: any = getStackOutput('search-complete');
const { errorQueueUrl: queueUrl } = completeOutput;

export const waitForSearchResponse = async ({
  indexClient,
  searchClient,
  message,
  expectEmpty = false,
  retryCount = 0,
  retryLimit = 60,
}: {
  indexClient: IndexClient<FlatResource>;
  searchClient: ReturnType<Client['searchClient']>;
  message: ReturnType<typeof generateMockMessageBody>;
  expectEmpty?: boolean;
  retryCount?: number;
  retryLimit?: number;
}): Promise<SearchResponse | undefined> => {
  if (expectEmpty) {
    // This is a hack to wait for the job... There isn't a great way to do this.
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  await indexClient.refreshIndex();

  const result = await searchClient.search({
    searchParameters: {
      q: `"${message.document.name}"`,
      pagination: {
        limit: 10,
        start: 0,
      },
    },
  });

  if (expectEmpty) {
    expect(result.total).toBe(0);
    return;
  }

  if (result.total === 0 && retryCount < retryLimit) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return waitForSearchResponse({
      indexClient,
      searchClient,
      message,
      retryLimit,
      retryCount: retryCount + 1,
    });
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
    if (retryCount < 200) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return waitForSQSMessage({ retryCount: retryCount + 1 });
    }
  }

  return result;
};

describe('resources-search-index', () => {
  const searchClients: Record<string, any> = {};
  const indexClients: Record<string, IndexClient<FlatResource>> = {};
  beforeEach(async () => {
    await purgeSqsQueue({ queueUrl });
    await Promise.all(
      accountSids.map(async accountSid => {
        const client = await getClient({
          accountSid: accountSid,
          indexType,
          config: {
            node: 'http://localhost:9200',
          },
        });
        searchClients[accountSid] = client.searchClient(resourceSearchConfiguration);
        indexClients[accountSid] = client.indexClient(resourceIndexConfiguration);

        // This is a bit of a hack to get the client to connect to the localstack instance on localhost
        // instead of using the localstack ssm parameter which points to the internal docker network
        // address of the elasticsearch container: http://elasticsearch:9200
        await indexClients[accountSid].createIndex({});
      }),
    );
  });

  afterEach(async () => {
    await Promise.all(
      accountSids.map(async accountSid => {
        await indexClients[accountSid].deleteIndex();
      }),
    );

    await purgeSqsQueue({ queueUrl });
  });

  test('well formed single message results in indexed document', async () => {
    const message = generateMockMessageBody();
    const sqsResp = await sendMessage({
      // messageGroupId: message.document.id,
      message,
      lambdaName,
    });
    expect(sqsResp).toHaveProperty('MessageId');

    const searchResult = await waitForSearchResponse({
      indexClient: indexClients[message.accountSid],
      searchClient: searchClients[message.accountSid],
      message,
    });
    expect(searchResult).toHaveProperty('total');
    expect(searchResult).toHaveProperty('items');
    expect(searchResult?.total).toEqual(1);
    expect(searchResult?.items).toHaveLength(1);
    expect(searchResult?.items[0]).toHaveProperty('id');
    expect(searchResult?.items[0].id).toEqual(message.document.id);
  });

  test('well formed bulk messages results in bulk indexed document', async () => {
    const messages = [...Array(5)].map(() => generateMockMessageBody());

    const sqsResp = await sendMessageBatch({
      // groupIdProperty: 'document',
      // groupIdField: 'id',
      messages,
      lambdaName,
    });
    expect(sqsResp).toHaveProperty('ResponseMetadata');

    await Promise.all(
      messages.map(async message => {
        const searchResult = await waitForSearchResponse({
          indexClient: indexClients[message.accountSid],
          searchClient: searchClients[message.accountSid],
          message,
          retryLimit: 10,
        });
        expect(searchResult).toHaveProperty('total');
        expect(searchResult).toHaveProperty('items');
        expect(searchResult?.total).toEqual(1);
        expect(searchResult?.items).toHaveLength(1);
        expect(searchResult?.items[0]).toHaveProperty('id');
        expect(searchResult?.items[0].id).toEqual(message.document.id);
      }),
    );
  });

  // Localstack fifo queues don't really work so don't bother with this for now
  // see https://github.com/localstack/localstack/issues/6766
  // test('well formed bulk messages with single document update results in index of final document', async () => {
  //   const baseMessage = generateMockMessageBody();
  //   const messages = [...Array(5)].map(idx => ({
  //     ...baseMessage,
  //     document: { ...baseMessage.document, name: `${baseMessage.document.name} ${idx}` },
  //   }));

  //   const sqsResp = await sendMessageBatch({
  //     groupIdProperty: 'document',
  //     groupIdField: 'id',
  //     messages,
  //     lambdaName,
  //   });
  //   expect(sqsResp).toHaveProperty('ResponseMetadata');

  //   for (const [idx, message] of messages.entries()) {
  //     const isFinal = idx === messages.length - 1;
  //     const searchResult = await waitForSearchResponse({
  //       client: searchClients[message.accountSid],
  //       message,
  //       retryLimit: 10,
  //       expectEmpty: !isFinal,
  //     });
  //     expect(searchResult).toHaveProperty('total');
  //     expect(searchResult).toHaveProperty('items');

  //     if (!isFinal) return;

  //     expect(searchResult?.total).toEqual(1);
  //     expect(searchResult?.items).toHaveLength(1);
  //     expect(searchResult?.items[0]).toHaveProperty('id');
  //     expect(searchResult?.items[0].id).toEqual(message.document.id);
  //   }
  // });

  test('message with bad accountSid produces failure message in complete queue', async () => {
    const message = { ...generateMockMessageBody(), accountSid: 'badSid' };
    const sqsResp = await sendMessage({
      // messageGroupId: message.document.id,
      message,
      lambdaName,
    });
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

  test('message with malformed document produces failure message in complete queue', async () => {
    const message = { hi: 'i am a bad message' };
    const sqsResp = await sendMessage({
      // messageGroupId: 'doesNotMatter',
      message,
      lambdaName,
    });
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
