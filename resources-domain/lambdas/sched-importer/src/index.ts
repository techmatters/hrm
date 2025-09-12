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
import type {
  ImportBatch,
  ImportProgress,
  TimeSequence,
} from '@tech-matters/resources-types';
import parseISO from 'date-fns/parseISO';
import {
  publishToImportConsumer,
  ResourceMessage,
  retrieveUnprocessedMessageCount,
} from '@tech-matters/resources-import-producer';
import getConfig from './config';
import path from 'path';
import { newSqsClient, SqsClient } from '@tech-matters/sqs-client';
import { transformKhpResourceToApiResource } from './khpMappings';

export type HttpError<T = any> = {
  status: number;
  statusText: string;
  body: T;
};

export const isHttpError = <T>(value: any): value is HttpError<T> => {
  return (
    typeof value?.status === 'number' &&
    typeof value?.statusText === 'string' &&
    typeof value?.body !== 'undefined'
  );
};

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

const nextTimeSequence = (timeSequence: TimeSequence): TimeSequence => {
  const [timestamp, sequence] = timeSequence.split('-');
  return `${Number(timestamp)}-${Number(sequence) + 1}`;
};

const retrieveCurrentStatus =
  (internalResourcesBaseUrl: URL, internalResourcesApiKey: string) =>
  async (accountSid: AccountSID): Promise<ImportProgress | undefined | HttpError> => {
    const response = await fetch(
      new URL(
        `/v0/accounts/${accountSid}/resources/import/progress`,
        internalResourcesBaseUrl,
      ),
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${internalResourcesApiKey}`,
        },
      },
    );
    if (response.ok) {
      return response.json() as Promise<ImportProgress>;
    } else {
      if (response.status === 404) {
        return undefined;
      }
      return {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      };
    }
  };

export type KhpApiResource = {
  _id: string;
  updatedAt: string;
  name: { en: string } & Record<string, string>;
} & Record<string, any>;

export type KhpApiResponse = {
  data: KhpApiResource[];
  totalResults: number;
  nextFrom?: TimeSequence;
};

const pullUpdates =
  (
    externalApiBaseUrl: URL,
    externalApiKey: string,
    externalApiAuthorizationHeader: string,
    maxApiResources: number,
  ) =>
  async (
    from: TimeSequence,
    to: TimeSequence,
    remaining = maxApiResources,
  ): Promise<KhpApiResponse | HttpError> => {
    const fetchUrl = new URL(
      path.join(
        externalApiBaseUrl.pathname,
        `api/resources?startSequence=${from}&endSequence=${to}&limit=${Math.min(
          remaining,
          maxApiResources,
        )}`,
      ),
      externalApiBaseUrl,
    );
    const response = await fetch(fetchUrl, {
      headers: {
        Authorization: externalApiAuthorizationHeader,
        'x-api-key': externalApiKey,
      },
      method: 'GET',
      signal: AbortSignal.timeout(15 * 60 * 1000), // 15 minutes
    });

    if (response.ok) {
      const { data: fullResults, totalResults } =
        (await response.json()) as KhpApiResponse;
      console.info(
        `[GET ${fetchUrl}] Retrieved ${fullResults.length} resources of ${totalResults} from ${from} to ${to}.`,
      );

      const result = {
        data: fullResults,
        totalResults,
      };

      if (fullResults.length && fullResults.length < totalResults) {
        // There is more left to retrieve from this range, provide the 'fromSequence' value for the next request
        return {
          ...result,
          nextFrom: nextTimeSequence(
            fullResults[fullResults.length - 1].timeSequence as TimeSequence,
          ),
        };
      } else return result;
    } else {
      return {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      };
    }
  };

const sendUpdates =
  (accountSid: AccountSID, sqs: SqsClient, importResourcesSqsQueueUrl: URL) =>
  async (resources: KhpApiResource[], importBatch: ImportBatch): Promise<void> => {
    let { remaining } = importBatch;
    for (const khpResource of resources) {
      remaining--;
      try {
        console.debug(
          `[Imported Resource Trace] Transforming resource ${accountSid}/${khpResource._id}:`,
        );
        const transformedResource: ResourceMessage = {
          batch: { ...importBatch, remaining },
          importedResources: [transformKhpResourceToApiResource(accountSid, khpResource)],
          accountSid,
        };
        console.debug(
          `[Imported Resource Trace] Publishing resource ${accountSid}/${khpResource._id}:`,
        );
        await publishToImportConsumer(
          sqs,
          importResourcesSqsQueueUrl,
        )(transformedResource);
        console.debug(
          `[Imported Resource Trace] Published resource ${accountSid}/${khpResource._id}:`,
        );
      } catch (error) {
        console.error(
          `[Imported Resource Trace] Unable to transform & send resource ${accountSid}/${khpResource._id}:`,
          error,
        );
      }
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

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.debug('Triggered by event:', JSON.stringify(event));

  const {
    accountSid,
    importApiBaseUrl,
    importApiAuthHeader,
    importApiKey,
    internalResourcesBaseUrl,
    internalResourcesApiKey,
    importResourcesSqsQueueUrl,
    maxBatchSize,
    maxRequests,
    maxApiSize,
    largeMessagesS3Bucket,
  } = await getConfig();
  const configuredPull = pullUpdates(
    importApiBaseUrl,
    importApiKey,
    importApiAuthHeader,
    maxApiSize,
  );
  const sqs = newSqsClient({
    largeMessageS3BaseLocation: {
      bucket: largeMessagesS3Bucket,
      key: 'sqsLargeMessageContent',
    },
  });
  const configuredSend = sendUpdates(accountSid, sqs, importResourcesSqsQueueUrl);

  // Wait until the target queue is empty, otherwise the progress tracking on the DB will not account for the unprocessed messages and process the same resources again
  await waitForEmptyQueue(importResourcesSqsQueueUrl);

  console.debug('Target queue empty, reading current import status.');
  const progress = await retrieveCurrentStatus(
    internalResourcesBaseUrl,
    internalResourcesApiKey,
  )(accountSid);
  const now: TimeSequence = `${Date.now()}-0`;
  if (isHttpError<any>(progress)) {
    throw new Error(
      `Failed to retrieve import progress: ${progress.status} (${progress.statusText}). Response body: ${progress.body}`,
    );
  }

  // Fair bit of state to track over each loop...
  let nextFrom = progress
    ? nextTimeSequence(
        progress.importSequenceId ??
          `${parseISO(progress.lastProcessedDate).valueOf()}-0`,
      )
    : '0-0';
  console.info(
    `Starting import from: ${nextFrom} (${progress ? 'resuming' : 'initial'}${
      progress?.importSequenceId ? 'import sequence supplied.' : ''
    })`,
  );
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
