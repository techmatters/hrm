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

import type { AccountSID } from '@tech-matters/types';
import type { FlatResource } from '@tech-matters/resources-types';
import { db, pgp } from '../connection-pool';
import { generateSelectResourcesForReindexSql } from './sql/adminSearchSql';
import QueryStream from 'pg-query-stream';
import ReadableStream = NodeJS.ReadableStream;

export const getResourcesBatchForReindexing = async ({
  lastUpdatedFrom,
  lastUpdatedTo,
  accountSid,
  resourceIds,
  start = 0,
  limit = 1000,
}: {
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  accountSid?: AccountSID;
  resourceIds?: string[];
  start?: number;
  limit?: number;
}): Promise<FlatResource[]> => {
  return db.task(async tx => {
    return tx.manyOrNone(generateSelectResourcesForReindexSql(Boolean(resourceIds)), {
      lastUpdatedFrom,
      lastUpdatedTo,
      accountSid,
      resourceIds,
      start,
      limit,
    });
  });
};

export const streamResourcesForReindexing = async ({
  lastUpdatedFrom,
  lastUpdatedTo,
  accountSid,
  resourceIds,
  batchSize = 1000,
}: {
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  accountSid?: AccountSID;
  resourceIds?: string[];
  batchSize?: number;
}): Promise<ReadableStream> => {
  const qs = new QueryStream(
    pgp.as.format(generateSelectResourcesForReindexSql(Boolean(resourceIds)), {
      lastUpdatedFrom,
      lastUpdatedTo,
      accountSid,
      resourceIds,
      start: 0,
      limit: Number.MAX_SAFE_INTEGER,
    }),
    [],
    { highWaterMark: batchSize },
  );

  // Expose the readable stream to the caller as a promise for further pipelining
  return new Promise(resolve => {
    db.stream(qs, resultStream => {
      resolve(resultStream);
    });
  });
};
