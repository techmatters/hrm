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

// eslint-disable-next-line prettier/prettier
import type { ScheduledEvent } from 'aws-lambda';
import type { AccountSID, ImportApiResource, ImportBatch, ImportProgress } from '@tech-matters/types';
import sortedIndexBy from 'lodash/sortedIndexBy';
import parseISO from 'date-fns/parseISO';
import addMilliseconds from 'date-fns/addMilliseconds';
import { publishToImportConsumer, ResourceMessage } from './clientSqs';
import getConfig from './config';

declare var fetch: typeof import('undici').fetch;

const updateBatchSize = Number(process.env.UPDATE_BATCH_SIZE ?? 1000);
const maxAttempts = Number(process.env.MAX_RESOURCE_ATTEMPTS ?? 100);

export type HttpError<T = any> = {
  status: number;
  statusText: string;
  body: T;
};

export const isHttpError = <T>(value: any): value is HttpError<T> => {
  return typeof value?.status === 'number' && typeof value?.statusText === 'string' && typeof value?.body !== 'undefined';
};

const retrieveCurrentStatus = (internalResourcesBaseUrl: URL, internalResourcesApiKey: string) => async (accountSid: AccountSID): Promise<ImportProgress | HttpError> => {
  const response  = await fetch(new URL(`/v0/accounts/${accountSid}/resources/import/progress`, internalResourcesBaseUrl), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${internalResourcesApiKey}`,
    },
  });
  if (response.ok) {
    return response.json() as Promise<ImportProgress>;
  } else {
    return {
      status: response.status,
      statusText: response.statusText,
      body: await response.text(),
    };
  }
};

export type KhpApiResource = ({ objectId: string, updatedAt: string, name: { en: string } & Record<string, string> } & Record<string, any>);
export type KhpApiResponse = {
  data: KhpApiResource[];
  totalResults: number;
};

/**
 * Stub implementation of a routine to transform the resources provided by the KHP API to the ImportApiResource format used by the write lambda
 * @param khpReferenceNumber
 * @param name
 * @param updatedAt
 */
const transformKhpResourceToApiResource = ({ objectId, name: { en: name }, updatedAt }: KhpApiResource): ImportApiResource => {
  if (!objectId || !name || !updatedAt) {
    throw new Error(`Invalid resource provided, missing required parameter: ${JSON.stringify({ objectId, name, updatedAt })}`);
  }

  return {
    id: objectId,
    updatedAt,
    name,
    attributes: {
      ResourceStringAttributes: [],
      ResourceNumberAttributes: [],
      ResourceBooleanAttributes: [],
      ResourceDateTimeAttributes: [],
      ResourceReferenceStringAttributes: [],
    },
  };
};

const pullUpdates = (externalApiBaseUrl: URL, externalApiKey: string, externalApiAuthorizationHeader: string) => {
  const configuredPullUpdates = async (from: Date, to: Date, lastObjectId: string = '', limit = updateBatchSize): Promise<KhpApiResponse | HttpError> => {
    const response = await fetch(new URL(`api/resources?sort=updatedAt&fromDate=${from.toISOString()}&toDate=${to.toISOString()}&limit=${updateBatchSize}`, externalApiBaseUrl), {
      headers: {
        'Authorization': externalApiAuthorizationHeader,
        'x-api-key': externalApiKey,
      },
      method: 'GET',
    });
    if (response.ok) {
      const { data:fullResults, totalResults } = await response.json() as KhpApiResponse;
      const batchStartIndex = limit - updateBatchSize;
      const batch = fullResults.slice(batchStartIndex);
      const maxIndex = sortedIndexBy(batch, { updatedAt: addMilliseconds(from, 1).toISOString() } as KhpApiResource, resource => parseISO(resource.updatedAt) );
      const index = sortedIndexBy(batch.slice(0, maxIndex), { objectId: lastObjectId } as KhpApiResource, 'resourceID');

      if (index && (batchStartIndex + index + updateBatchSize) <= fullResults.length && fullResults.length < totalResults) {
        // We had to search into the initial batch to find the 'real' index amongst records with the same updated timestamp.
        // Either we found the 'real' index in the batch and we are just requerying to ensure we have a full size batch to process
        // Or we didn't find the 'real' index in the batch and we need to pull again with another full batch's worth of records added to keep looking.
        if (limit < maxAttempts * updateBatchSize) {
          return configuredPullUpdates(from, to, lastObjectId, batchStartIndex + index);
        } else {
          throw new Error(`Unable to find last processed resource after trawling ${limit} resources.`);
        }
      } else {
        return {
          data:batch.slice(index),
          totalResults: totalResults - (batchStartIndex + index),
        };
      }
    } else {
      return {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      };
    }
  };
  return configuredPullUpdates;
};

const sendUpdates = (accountSid: AccountSID, importResourcesSqsQueueUrl: URL) => async (resources: KhpApiResource[], importBatch: ImportBatch): Promise<void> => {
  let { remaining } = importBatch;
  for (const khpResource of resources) {
    remaining--;
    try {
      const transformedResource: ResourceMessage = {
        batch: { ...importBatch, remaining },
        importedResources: [transformKhpResourceToApiResource(khpResource)],
        accountSid,
      };
      await publishToImportConsumer(importResourcesSqsQueueUrl)(transformedResource);
    } catch (error) {
      console.error(`Unable to read or send resource ${JSON.stringify(khpResource)}:`, error);
    }
  }
};

export const handler = async (
  event: ScheduledEvent,
): Promise<void> => {
  console.log('Triggered by event:', JSON.stringify(event));

  const {
    accountSid,
    importApiBaseUrl,
    importApiAuthHeader,
    importApiKey,
    internalResourcesBaseUrl,
    internalResourcesApiKey,
    importResourcesSqsQueueUrl } = await getConfig();
  const configuredPull = pullUpdates(importApiBaseUrl, importApiKey, importApiAuthHeader);

  const progress = await retrieveCurrentStatus(internalResourcesBaseUrl, internalResourcesApiKey)(accountSid);
  let importBatch: Omit<ImportBatch, 'remaining'>;
  let updatedResources: KhpApiResponse | HttpError;
  const now = new Date();
  if (isHttpError(progress)) {
    // No record of any import being attempted, start from scratch
    if (progress.status === 404) {
      console.debug('No import in progress detected for account, starting from scratch');
      updatedResources = await configuredPull(new Date(0), now);
      importBatch = {
        toDate: now.toISOString(),
        fromDate: new Date(0).toISOString(),
      };
    } else {
      throw new Error(`Failed to retrieve import progress: ${progress.status} (${progress.statusText}). Response body: ${progress.body}`);
    }
  } else {
    // Resume importing based on the state left by the last import.
    const fromDate = addMilliseconds(parseISO(progress.lastProcessedDate), (progress.lastProcessedId && progress.remaining) ? 0 : 1);
    updatedResources = await configuredPull(fromDate, now, progress.lastProcessedId);
    importBatch = {
      fromDate: fromDate.toISOString(),
      toDate: now.toISOString(),
    };
  }
  if (isHttpError(updatedResources)) {
    throw new Error(`Failed to retrieve updates: ${updatedResources.status} (${updatedResources.statusText}). Response body: ${updatedResources.body}`);
  } else {
    await sendUpdates(accountSid, importResourcesSqsQueueUrl)(updatedResources.data, { ...importBatch, remaining: updatedResources.totalResults });
  }
};
