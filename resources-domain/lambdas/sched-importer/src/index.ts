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

import type { ScheduledEvent } from 'aws-lambda';
import type { AccountSID } from '@tech-matters/types';
import type { ImportBatch } from '@tech-matters/resources-types';
import {
  publishToImportConsumer,
  ResourceMessage,
  retrieveUnprocessedMessageCount,
} from '@tech-matters/resources-import-producer';
import getConfig from './config';
import { newSqsClient, SqsClient } from '@tech-matters/sqs-client';
import { isHttpError, NativeResource } from './clients';
import { getIntegration } from './integrations';

export { HttpError, isHttpError, KhpApiResource, KhpApiResponse } from './clients';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForEmptyQueue = async (importResourcesSqsQueueUrl: URL) => {
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

const sendUpdates =
  (
    accountSid: AccountSID,
    sqs: SqsClient,
    importResourcesSqsQueueUrl: URL,
    transform: ReturnType<typeof getIntegration>['transform'],
    failOnSendError: boolean,
  ) =>
  async (resources: NativeResource[], importBatch: ImportBatch): Promise<void> => {
    let { remaining } = importBatch;
    let failed = false;
    for (const resource of resources) {
      remaining--;
      try {
        const mappedResource = transform(accountSid, resource);
        console.debug(
          `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${mappedResource.id}): Transforming resource to standard format for import.`,
        );
        const transformedResource: ResourceMessage = {
          batch: { ...importBatch, remaining },
          importedResources: [mappedResource],
          accountSid,
        };
        console.debug(
          `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${mappedResource.id}): Publishing resource to import pending queue`,
        );
        const output = await publishToImportConsumer(
          sqs,
          importResourcesSqsQueueUrl,
        )(transformedResource);
        if (failOnSendError && !output) {
          throw new Error('Failed to publish resource to import queue');
        }
        console.debug(
          `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${mappedResource.id}): Published resource to import pending queue.`,
          output,
        );
      } catch (error) {
        failed = true;
        console.error(
          `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${
            resource._id ?? resource.id
          }): Unable to transform & send resource.`,
          error,
        );
      }
    }
    if (failed && failOnSendError) {
      throw new Error('Failed to transform or publish one or more resources');
    }
  };

const describeRemaining = (
  batchSize: number,
  batchRemaining: number,
  rangeRemaining: number | undefined,
): string =>
  `${
    batchSize - batchRemaining
  } resources imported with ${batchRemaining} left in batch, ${
    rangeRemaining ?? 'unknown number of resources'
  } left in sequence range`;

export const handler = async (
  event: ScheduledEvent & { helplineShortCode?: string },
): Promise<void> => {
  console.debug('Triggered by event:', JSON.stringify(event));

  const shortCode = event.helplineShortCode ?? process.env.helpline_short_code ?? 'as';
  const integration = getIntegration(shortCode);
  const config = await getConfig(
    shortCode,
    integration.needsApiKey,
    integration.needsProgress,
  );
  const { accountSid, importResourcesSqsQueueUrl, largeMessagesS3Bucket } = config;
  const configuredPull = integration.createClient(config);
  const sqs = newSqsClient({
    largeMessageS3BaseLocation: {
      bucket: largeMessagesS3Bucket,
      key: 'sqsLargeMessageContent',
    },
  });
  const configuredSend = sendUpdates(
    accountSid,
    sqs,
    importResourcesSqsQueueUrl,
    integration.transform,
    integration.failOnSendError,
  );

  // Wait until the target queue is empty, otherwise the progress tracking on the DB will not account for the unprocessed messages and process the same resources again
  await waitForEmptyQueue(importResourcesSqsQueueUrl);

  console.debug('Target queue empty, reading current import status.');
  const { from, to: now, maxBatchSize, maxRequests } = await integration.progress(config);
  let nextFrom = from;
  let remaining = maxBatchSize;
  let totalRemaining: number | undefined;
  let requestsMade = 0;

  while (remaining > 0) {
    if (requestsMade >= maxRequests) {
      console.warn(
        `Reached max requests (${maxRequests}) for this batch, aborting after ${describeRemaining(
          maxBatchSize,
          remaining,
          totalRemaining,
        )} processed.`,
      );
      return;
    }
    const result = await configuredPull(nextFrom, now, remaining);
    requestsMade++;
    if (isHttpError<any>(result)) {
      console.error(
        `Error calling import API, aborting after ${describeRemaining(
          maxBatchSize,
          remaining,
          totalRemaining,
        )}.`,
      );
      throw new Error(
        `Failed to retrieve updates: ${result.status} (${result.statusText}). Response body: ${result.body}. `,
      );
    }
    remaining = remaining - result.data.length;
    totalRemaining = result.totalResults - result.data.length;
    await configuredSend(result.data, {
      fromSequence: nextFrom,
      toSequence: now,
      remaining: result.totalResults,
    });
    if (result.nextFrom) {
      nextFrom = result.nextFrom;
      console.debug(
        `Continuing import from: ${nextFrom} with another pull from the API...`,
      );
    } else {
      console.info(
        `Import operation complete due to there being no more resources to import, ${describeRemaining(
          maxBatchSize,
          remaining,
          totalRemaining,
        )}`,
      );
      return;
    }
  }
  console.info(
    `Import operation complete due to importing the maximum of batch resources, ${describeRemaining(
      maxBatchSize,
      remaining,
      totalRemaining,
    )}`,
  );
};
