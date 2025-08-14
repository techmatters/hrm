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
import { streamResourcesForReindexing } from './adminSearchDataAccess';
import { AccountSID } from '@tech-matters/types';
import { FlatResource } from '@tech-matters/resources-types';
import { publishSearchIndexJob } from '../resource-jobs/client-sqs';
import ReadableStream = NodeJS.ReadableStream;
import { Transform } from 'stream';

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

export type VerboseSearchReindexResultItem = {
  resourceId: string;
  accountSid: string;
  error?: Error;
};

export type VerboseSearchReindexResult = ConciseSearchReindexResult & {
  successfullySubmitted: { resourceId: string; accountSid: string }[];
  failedToSubmit: { resourceId: string; accountSid: string; error: Error }[];
};

export type AdminSearchServiceConfiguration = {
  reindexDbBatchSize: number;
};

const sendResourceAndRecordResult = async (
  resource: FlatResource,
): Promise<VerboseSearchReindexResultItem> => {
  // We could possibly double down on the streaming pattern and return the response as a JSON stream
  // This should probably only be done in a more streaming friendly format like CSV or JSONL
  // We could return the full content in a CSV if the client specifies an 'text/csv' accept header, or the current version for 'application/json'
  // But this is is very likely to be a 'YAGNI' feature, so I'm leaving it out for now
  try {
    console.debug('Queueing resource for reindexing:', resource?.id);
    await publishSearchIndexJob(resource.accountSid, resource);
    console.debug('Queued resource for reindexing:', resource?.id);
    return {
      resourceId: resource.id,
      accountSid: resource.accountSid,
    };
  } catch (error) {
    console.error(`Failed to queue resource for reindexing:`, resource?.id, error);
    return {
      accountSid: resource.accountSid,
      resourceId: resource.id,
      error: error as Error,
    };
  }
};

const newAdminSearchService = ({
  reindexDbBatchSize,
}: AdminSearchServiceConfiguration) => {
  return {
    reindexStream: async (params: SearchReindexParams): Promise<ReadableStream> => {
      console.debug('Querying DB for resources to index', params);
      const resourcesStream: ReadableStream = await streamResourcesForReindexing({
        ...params,
        batchSize: reindexDbBatchSize,
      });

      console.debug('Piping resources to queue for reindexing', params);
      return resourcesStream.pipe(
        new Transform({
          objectMode: true,
          highWaterMark: reindexDbBatchSize,
          async transform(resource, _, callback) {
            const { accountSid, resourceId, error } =
              await sendResourceAndRecordResult(resource);

            this.push(
              `${new Date().toISOString()},${accountSid},${resourceId},${
                error ? `"${error.message.replace('"', '""')}"` : 'Success'
              }\n`,
            );
            callback();
          },
        }),
      );
    },
  };
};

export default newAdminSearchService;
