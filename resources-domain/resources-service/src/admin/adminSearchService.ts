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
import {
  getResourcesBatchForReindexing,
  streamResourcesForReindexing,
} from './adminSearchDataAccess';
import { AccountSID, FlatResource } from '@tech-matters/types';
import { publishSearchIndexJob } from '../resource-jobs/client-sqs';
import ReadableStream = NodeJS.ReadableStream;
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';

export type SearchReindexParams = {
  resourceIds?: string[];
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  accountSid?: AccountSID;
};

export const enum ResponseType {
  VERBOSE = 'verbose',
  CONCISE = 'concise',
}

export type ConciseSearchReindexResult = {
  successfulSubmissionCount: number;
  submissionErrorCount: number;
};

export type VerboseSearchReindexResult = ConciseSearchReindexResult & {
  successfullySubmitted: string[];
  failedToSubmit: { resourceId: string; error: Error }[];
};

export type AdminSearchServiceConfiguration = {
  reindexDbBatchSize: number;
};

const sendResourceAndRecordResult = async (
  resource: FlatResource,
  response: VerboseSearchReindexResult,
  responseType: ResponseType,
): Promise<void> => {
  // We could possibly double down on the streaming pattern and return the response as a JSON stream
  // This should probably only be done in a more streaming friendly format like CSV or JSONL
  // We could return the full content in a CSV if the client specifies an 'text/csv' accept header, or the current version for 'application/json'
  // But this is is very likely to be a 'YAGNI' feature, so I'm leaving it out for now
  try {
    await publishSearchIndexJob(resource.accountSid, resource);
    response.successfulSubmissionCount++;
    if (responseType === ResponseType.VERBOSE) {
      response.successfullySubmitted.push(resource.id);
    }
  } catch (error) {
    response.submissionErrorCount++;
    if (responseType === ResponseType.VERBOSE && response.submissionErrorCount <= 50) {
      if (response.submissionErrorCount === 50) {
        response.failedToSubmit.push({
          resourceId: resource.id,
          error: new Error('Stopping logging errors after 50'),
        });
      }
      response.failedToSubmit.push({ resourceId: resource.id, error: error as Error });
    }
  }
};

const newAdminSearchService = ({ reindexDbBatchSize }: AdminSearchServiceConfiguration) => {
  return {
    reindexBatches: async (
      params: SearchReindexParams,
      responseType: ResponseType,
    ): Promise<ConciseSearchReindexResult | VerboseSearchReindexResult> => {
      let previousBatchResultCount = reindexDbBatchSize,
        batchesSent = 0;
      let response: VerboseSearchReindexResult = {
        successfulSubmissionCount: 0,
        submissionErrorCount: 0,
        successfullySubmitted: [],
        failedToSubmit: [],
      };

      // Keep querying the DB for resources to index until we get less than the batch size, which means we've reached the end
      while (previousBatchResultCount === reindexDbBatchSize) {
        const resourcesToIndex = await getResourcesBatchForReindexing({
          ...params,
          start: batchesSent * reindexDbBatchSize,
          limit: reindexDbBatchSize,
        });
        previousBatchResultCount = resourcesToIndex.length;
        console.log('resources found to index', resourcesToIndex.length);

        for (const resource of resourcesToIndex) {
          await sendResourceAndRecordResult(resource, response, responseType);
        }
        batchesSent++;
      }

      return responseType === ResponseType.CONCISE
        ? {
            successfulSubmissionCount: response.successfulSubmissionCount,
            submissionErrorCount: response.submissionErrorCount,
          }
        : response;
    },

    reindexStream: async (
      params: SearchReindexParams,
      responseType: ResponseType,
    ): Promise<ConciseSearchReindexResult | VerboseSearchReindexResult> => {
      let response: VerboseSearchReindexResult = {
        successfulSubmissionCount: 0,
        submissionErrorCount: 0,
        successfullySubmitted: [],
        failedToSubmit: [],
      };
      const resourcesStream: ReadableStream = await streamResourcesForReindexing({
        ...params,
        batchSize: reindexDbBatchSize,
      });
      await pipeline(
        resourcesStream,
        // I think in Node 19+ you can use async iterator functions directly in a pipeline, instead of Writeable / Readable / Transform streams
        // https://darkmannn.dev/posts/nodejs-in-2023-streams-streams-vs-async-generators
        // But I couldn't get it working in Node 18 so doing it old school with a Writable stream.
        new Writable({
          objectMode: true,
          highWaterMark: reindexDbBatchSize,
          write: async (resource, _, callback) => {
            try {
              await sendResourceAndRecordResult(resource, response, responseType);
            } finally {
              callback();
            }
          },
        }),
      );
      return responseType === ResponseType.CONCISE
        ? {
            successfulSubmissionCount: response.successfulSubmissionCount,
            submissionErrorCount: response.submissionErrorCount,
          }
        : response;
    },
  };
};

export default newAdminSearchService;
