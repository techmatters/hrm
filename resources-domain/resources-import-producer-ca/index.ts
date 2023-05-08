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
import type { ImportApiResource, ImportBatch, ImportProgress } from '@tech-matters/types';
import type { AccountSID } from '@tech-matters/twilio-worker-auth/dist';
import sortedIndexBy from 'lodash/sortedIndexBy';
import parseISO from 'date-fns/parseISO';
import addMilliseconds from 'date-fns/addMilliseconds';
import { publishToImportConsumer, ResourceMessage } from './clientSqs';

const internalResourcesBaseUrl = new URL(process.env.internal_resources_base_url ?? '');
const hrmEnv = process.env.NODE_ENV;
const configuredAccountSid = process.env.ACCOUNT_SID as AccountSID;
const externalApiBaseUrl = new URL(process.env.EXTERNAL_API_BASE_URL ?? '');
const externalApiAuthorizationHeader = process.env.EXTERNAL_API_AUTH_HEADER ?? '';
const externalApiKey = process.env.EXTERNAL_API_KEY ?? '';
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

const retrieveCurrentStatus = async (accountSid: AccountSID): Promise<ImportProgress | HttpError> => {
  const response  = await fetch(new URL(`/v0/accounts/${accountSid}/resources/import/progress`, internalResourcesBaseUrl), {
    method: 'GET',
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

export type KhpApiResource = ({ khpReferenceNumber: number, timestamps: { updatedAt: string } } & Record<string, any>);
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
const transformKhpResourceToApiResource = ({ khpReferenceNumber, name, timestamps: { updatedAt } }: KhpApiResource): ImportApiResource => ({
  id: khpReferenceNumber.toString(),
  updatedAt,
  name,
  attributes: {
    ResourceStringAttributes: [],
    ResourceNumberAttributes: [],
    ResourceBooleanAttributes: [],
    ResourceDateTimeAttributes: [],
    ResourceReferenceStringAttributes: [],
  },
  
});

const pullUpdates = async (from: Date, to: Date, lastKhpReferenceNumber: number = 0, limit = updateBatchSize): Promise<KhpApiResponse | HttpError> => {
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
    const maxIndex = sortedIndexBy(batch, { timestamps: { updatedAt: addMilliseconds(from, 1).toISOString() } } as KhpApiResource, resource => parseISO(resource.timestamps.updatedAt) );
    const index = sortedIndexBy(batch.slice(0, maxIndex), { khpReferenceNumber: lastKhpReferenceNumber } as KhpApiResource, 'resourceID');
    
    if (index && (batchStartIndex + index + updateBatchSize) <= fullResults.length && fullResults.length < totalResults) {
      // We had to search into the initial batch to find the 'real' index amongst records with the same updated timestamp.
      // Either we found the 'real' index in the batch and we are just requerying to ensure we have a full size batch to process
      // Or we didn't find the 'real' index in the batch and we need to pull again with another full batch's worth of records added to keep looking.
      if (limit < maxAttempts * updateBatchSize) {
        return pullUpdates(from, to, lastKhpReferenceNumber, batchStartIndex + index);
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

const sendUpdates = async (resources: KhpApiResource[], importBatch: ImportBatch): Promise<void> => {
  let { remaining } = importBatch;
  for (const khpResource of resources) {
    const transformedResource: ResourceMessage = {
      batch: { ...importBatch, remaining },
      importedResources: [transformKhpResourceToApiResource(khpResource)],
      accountSid: configuredAccountSid,
    };
    await publishToImportConsumer(transformedResource);
    remaining--;
  }
};

export const handler = async (
  event: ScheduledEvent,
): Promise<void> => {
  console.log('Triggered by event:', JSON.stringify(event));
  if (!internalResourcesBaseUrl) {
    throw new Error('Missing internal resources base url');
  }

  if (!hrmEnv) {
    throw new Error('Missing NODE_ENV');
  }

  const progress = await retrieveCurrentStatus(configuredAccountSid);
  let importBatch: Omit<ImportBatch, 'remaining'>;
  let updatedResources: KhpApiResponse | HttpError;
  const now = new Date();
  if (isHttpError(progress)) {
    // No record of any import being attempted, start from scratch
    if (progress.status === 404) {
      console.debug('No import in progress detected for account, starting from scratch');
      updatedResources = await pullUpdates(new Date(0), now);
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
    updatedResources = await pullUpdates(fromDate, now, parseInt(progress.lastProcessedId));
    importBatch = {
      fromDate: fromDate.toISOString(),
      toDate: now.toISOString(),
    };
  }
  if (isHttpError(updatedResources)) {
    throw new Error(`Failed to retrieve updates: ${updatedResources.status} (${updatedResources.statusText}). Response body: ${updatedResources.body}`);
  } else {
    await sendUpdates(updatedResources.data, { ...importBatch, remaining: updatedResources.totalResults });
  }
};
