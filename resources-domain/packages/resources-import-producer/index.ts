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

import { getQueueAttributes, SqsClient } from '@tech-matters/sqs-client';

import type { AccountSID } from '@tech-matters/types';
import type { ImportRequestBody } from '@tech-matters/resources-types';

export const publishToImportConsumer =
  (sqsClient: SqsClient, importResourcesSqsQueueUrl: URL) =>
  async (params: ResourceMessage) => {
    //TODO: more robust error handling/messaging
    try {
      const queueUrl = importResourcesSqsQueueUrl.toString();
      const messageGroupId = `${params.accountSid}/${
        params.importedResources[0]?.id ?? '__EMPTY_BATCH'
      }`;
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${messageGroupId}): Publishing resource to queue ${queueUrl} group ID ${messageGroupId}:`,
      );
      return await sqsClient.sendSqsMessage({
        message: JSON.stringify(params),
        queueUrl,
        messageGroupId,
      });
    } catch (err) {
      console.error('Error trying to send message to SQS queue', err);
    }
  };

export const retrieveUnprocessedMessageCount = async (
  importResourcesSqsQueueUrl: URL,
) => {
  const { ApproximateNumberOfMessages } = (await getQueueAttributes({
    queueUrl: importResourcesSqsQueueUrl.toString(),
    attributes: ['ApproximateNumberOfMessages'],
  })) ?? { ApproximateNumberOfMessages: '0' };
  return parseInt(ApproximateNumberOfMessages);
};

export type ResourceMessage = ImportRequestBody & { accountSid: AccountSID };

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitForEmptyQueue = async (importResourcesSqsQueueUrl: URL) => {
  let unprocessedCount: number | undefined;
  while (
    (unprocessedCount = await retrieveUnprocessedMessageCount(importResourcesSqsQueueUrl))
  ) {
    console.info(
      `${unprocessedCount} resources still to be processed from prior import run, waiting 10 seconds...`,
    );
    await delay(10000);
  }
};
