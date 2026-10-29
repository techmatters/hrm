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

import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getNativeS3Client } from '@tech-matters/s3-client';
import { Readable } from 'stream';
import {
  deleteAuditsByIds,
  findOldestAuditTimestamp,
  streamAuditBatchForDay,
} from './dataAccess';

const MAX_RUNTIME_MILLISECONDS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10_000;

type Audit = { id: number; [key: string]: unknown };
type S3ReadableClient = ReturnType<typeof getNativeS3Client>;

const utcDayStart = (date: Date): Date => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const getDayPrefix = (dayStart: Date): string => {
  const utcDay = dayStart.toISOString().slice(0, 10);
  return `audit-logs/${utcDay.slice(0, 4)}/${utcDay.slice(5, 7)}/${utcDay}-`;
};

const getNextFileSuffix = async (
  client: S3ReadableClient,
  bucket: string,
  prefix: string,
): Promise<number> => {
  let continuationToken: string | undefined;
  let nextSuffix = 0;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const { Key } of response.Contents ?? []) {
      const suffix = Key?.match(/-(\d+)\.jsonl$/)?.[1];
      if (suffix) nextSuffix = Math.max(nextSuffix, Number(suffix) + 1);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return nextSuffix;
};

const readBatch = async (
  stream: NodeJS.ReadableStream,
  batchSize: number,
  ids: number[],
): Promise<{ body: Readable } | undefined> => {
  const iterator = (stream as AsyncIterable<Audit>)[Symbol.asyncIterator]();
  const firstAudit = await iterator.next();
  if (firstAudit.done) {
    (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    return undefined;
  }

  return {
    body: Readable.from(
      (async function* () {
        let nextAudit = firstAudit;
        let count = 0;
        let streamEnded = false;
        try {
          while (!nextAudit.done && count < batchSize) {
            ids.push(nextAudit.value.id);
            count += 1;
            yield `${JSON.stringify(nextAudit.value)}\n`;
            if (count < batchSize) {
              nextAudit = await iterator.next();
            }
          }
          streamEnded = nextAudit.done;
        } finally {
          if (!streamEnded) {
            (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
          }
        }
      })(),
      { objectMode: false },
    ),
  };
};

const archiveBatch = async (
  client: S3ReadableClient,
  bucket: string,
  start: Date,
  end: Date,
  batchSize: number,
  suffix: number,
): Promise<{ key: string; deletedCount: number } | undefined> => {
  const stream = await streamAuditBatchForDay(start, end, batchSize);
  const ids: number[] = [];
  const batch = await readBatch(stream, batchSize, ids);
  if (!batch) return undefined;

  const key = `${getDayPrefix(start)}${String(suffix).padStart(4, '0')}.jsonl`;
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: batch.body,
      ContentType: 'application/x-ndjson',
    },
  });

  try {
    await upload.done();
  } catch (error) {
    (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    throw error;
  }

  return { key, deletedCount: await deleteAuditsByIds(ids) };
};

const getConfiguredBatchSize = (): number => {
  const configured = process.env.AUDIT_ARCHIVE_BATCH_SIZE;
  if (configured === undefined) return DEFAULT_BATCH_SIZE;

  const batchSize = Number(configured);
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error('AUDIT_ARCHIVE_BATCH_SIZE must be a positive safe integer');
  }
  return batchSize;
};

export const archiveAudits = async (
  bucket: string,
  now: Date = new Date(),
  batchSize: number = getConfiguredBatchSize(),
): Promise<{ archivedDays: number; deletedCount: number; keys: string[] }> => {
  if (!bucket) {
    throw new Error('An S3 bucket is required to archive audit logs');
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    throw new Error('Audit archive batch size must be a positive safe integer');
  }

  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  const eligibleBefore = utcDayStart(cutoff);
  const startedAt = Date.now();
  const client = getNativeS3Client();
  let archivedDays = 0;
  let deletedCount = 0;
  const keys: string[] = [];

  while (Date.now() - startedAt < MAX_RUNTIME_MILLISECONDS) {
    const oldestAudit = await findOldestAuditTimestamp(eligibleBefore);
    if (!oldestAudit) break;

    const dayStart = utcDayStart(oldestAudit);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const dayPrefix = getDayPrefix(dayStart);
    let suffix = await getNextFileSuffix(client, bucket, dayPrefix);
    let archivedThisDay = false;

    while (Date.now() - startedAt < MAX_RUNTIME_MILLISECONDS) {
      const batch = await archiveBatch(
        client,
        bucket,
        dayStart,
        dayEnd,
        batchSize,
        suffix,
      );
      if (!batch) break;

      keys.push(batch.key);
      deletedCount += batch.deletedCount;
      suffix += 1;
      archivedThisDay = true;
    }

    if (archivedThisDay) archivedDays += 1;
  }

  return { archivedDays, deletedCount, keys };
};
