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
import { createGzip } from 'zlib';
import {
  deleteAuditsByIds,
  findOldestAuditTimestamp,
  streamAuditBatchForDay,
} from './dataAccess';

const MAX_RUNTIME_MILLISECONDS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10_000;
const DEFAULT_RETENTION_DAYS = 730;

type Audit = { id: number; timestamp_clock?: Date | string; [key: string]: unknown };
type S3ReadableClient = ReturnType<typeof getNativeS3Client>;
type BatchMetadata = {
  count: number;
  firstId?: number;
  lastId?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  lookaheadId?: number;
  lookaheadTimestamp?: string;
};

const getAuditTimestamp = (audit: Audit): string | undefined => {
  if (audit.timestamp_clock instanceof Date) return audit.timestamp_clock.toISOString();
  return typeof audit.timestamp_clock === 'string' ? audit.timestamp_clock : undefined;
};

const utcDayStart = (date: Date): Date => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const getDayPrefix = (dayStart: Date): string => {
  const utcDay = dayStart.toISOString().slice(0, 10);
  return `audit-logs/${utcDay.slice(0, 4)}/${utcDay.slice(5, 7)}/${utcDay}-`;
};

const listS3Objects = async (
  client: S3ReadableClient,
  bucket: string,
  prefix: string,
  continuationToken?: string,
) => {
  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    return response;
  } catch (error) {
    console.error(
      `[scheduled-task:audit-log-archive]: Failed to list existing S3 files for ${prefix}`,
      error,
    );
    throw error;
  }
};

const getNextFileSuffix = async (
  client: S3ReadableClient,
  bucket: string,
  prefix: string,
): Promise<number> => {
  let continuationToken: string | undefined;
  let nextSuffix = 0;
  do {
    const response = await listS3Objects(client, bucket, prefix, continuationToken);
    console.debug(
      `[scheduled-task:audit-log-archive]: Listed ${
        response.Contents?.length ?? 0
      } existing S3 files for ${prefix}`,
    );
    for (const { Key } of response.Contents ?? []) {
      const suffix = Key?.match(/-(\d+)\.jsonl(?:\.gz)?$/)?.[1];
      if (suffix) nextSuffix = Math.max(nextSuffix, Number(suffix) + 1);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  console.debug(
    `[scheduled-task:audit-log-archive]: Next S3 file suffix for ${prefix} is ${nextSuffix}`,
  );
  return nextSuffix;
};

const readBatch = async (
  stream: NodeJS.ReadableStream,
  batchSize: number,
  ids: number[],
): Promise<{ body: Readable; metadata: BatchMetadata } | undefined> => {
  const iterator = (stream as AsyncIterable<Audit>)[Symbol.asyncIterator]();
  const firstAudit = await iterator.next();
  if (firstAudit.done) {
    (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    return undefined;
  }

  const metadata: BatchMetadata = { count: 0 };
  return {
    metadata,
    body: Readable.from(
      (async function* () {
        let nextAudit = firstAudit;
        let streamEnded = false;
        try {
          while (!nextAudit.done && metadata.count < batchSize) {
            ids.push(nextAudit.value.id);
            const timestamp = getAuditTimestamp(nextAudit.value);
            if (metadata.count === 0) {
              metadata.firstId = nextAudit.value.id;
              metadata.firstTimestamp = timestamp;
            }
            metadata.lastId = nextAudit.value.id;
            metadata.lastTimestamp = timestamp;
            metadata.count += 1;
            yield `${JSON.stringify(nextAudit.value)}\n`;
            nextAudit = await iterator.next();
          }
          if (!nextAudit.done) {
            metadata.lookaheadId = nextAudit.value.id;
            metadata.lookaheadTimestamp = getAuditTimestamp(nextAudit.value);
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
  let batch: Awaited<ReturnType<typeof readBatch>>;
  try {
    batch = await readBatch(stream, batchSize, ids);
  } catch (error) {
    console.error(
      `[scheduled-task:audit-log-archive]: Failed to read audit batch for UTC window ${start.toISOString()} to ${end.toISOString()}`,
      error,
    );
    throw error;
  }
  if (!batch) {
    console.debug(
      `[scheduled-task:audit-log-archive]: No audits remain in UTC window ${start.toISOString()} to ${end.toISOString()}`,
    );
    return undefined;
  }

  const key = `${getDayPrefix(start)}${String(suffix).padStart(4, '0')}.jsonl.gz`;
  console.debug(
    `[scheduled-task:audit-log-archive]: Uploading batch ${suffix} for UTC day ${start.toISOString()} to s3://${bucket}/${key}`,
  );
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: batch.body.pipe(createGzip()),
      ContentType: 'application/x-ndjson',
      ContentEncoding: 'gzip',
    },
  });

  try {
    await upload.done();
  } catch (error) {
    (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    console.error(
      `[scheduled-task:audit-log-archive]: S3 upload failed for ${key}; ${batch.metadata.count} audits read, first ID ${batch.metadata.firstId}, last ID ${batch.metadata.lastId}, timestamp range ${batch.metadata.firstTimestamp} to ${batch.metadata.lastTimestamp}; no audit IDs were deleted`,
      error,
    );
    throw error;
  }

  console.info(
    `[scheduled-task:audit-log-archive]: Uploaded ${batch.metadata.count} audits to ${key}; first ID ${batch.metadata.firstId}, last ID ${batch.metadata.lastId}, timestamp range ${batch.metadata.firstTimestamp} to ${batch.metadata.lastTimestamp}`,
  );
  if (batch.metadata.lookaheadId !== undefined) {
    console.debug(
      `[scheduled-task:audit-log-archive]: Retaining lookahead audit ID ${batch.metadata.lookaheadId} at ${batch.metadata.lookaheadTimestamp}; it will be queried in the next batch`,
    );
  }

  try {
    const deletedCount = await deleteAuditsByIds(ids);
    console.info(
      `[scheduled-task:audit-log-archive]: Finished batch ${key}; deleted ${deletedCount} of ${batch.metadata.count} uploaded audits`,
    );
    return { key, deletedCount };
  } catch (error) {
    console.error(
      `[scheduled-task:audit-log-archive]: Database deletion failed after upload to ${key}; uploaded audit IDs remain available for retry`,
      error,
    );
    throw error;
  }
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

const getConfiguredRetentionDays = (): number => {
  const configured = process.env.AUDIT_ARCHIVE_RETENTION_DAYS;
  if (configured === undefined) return DEFAULT_RETENTION_DAYS;

  const retentionDays = Number(configured);
  if (
    configured.trim() === '' ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 0
  ) {
    throw new Error('AUDIT_ARCHIVE_RETENTION_DAYS must be a non-negative safe integer');
  }
  return retentionDays;
};

export const archiveAudits = async (
  now: Date = new Date(),
  batchSize?: number,
): Promise<{ archivedDays: number; deletedCount: number; keys: string[] }> => {
  const bucket = process.env.AUDIT_ARCHIVE_BUCKET;
  if (!bucket?.trim()) {
    throw new Error(
      'AUDIT_ARCHIVE_BUCKET environment variable must be set to archive audit logs',
    );
  }
  const batchLimit = batchSize ?? getConfiguredBatchSize();
  if (!Number.isSafeInteger(batchLimit) || batchLimit < 1) {
    throw new Error('Audit archive batch size must be a positive safe integer');
  }

  const retentionDays = getConfiguredRetentionDays();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  if (!Number.isFinite(cutoff.getTime())) {
    throw new Error('AUDIT_ARCHIVE_RETENTION_DAYS results in an unsupported cutoff date');
  }
  const eligibleBefore = utcDayStart(cutoff);
  const startedAt = Date.now();
  const client = getNativeS3Client();
  let archivedDays = 0;
  let deletedCount = 0;
  const keys: string[] = [];

  console.info(
    `[scheduled-task:audit-log-archive]: Starting archive for bucket ${bucket}; cutoff ${eligibleBefore.toISOString()}, batch size ${batchLimit}, max runtime ${MAX_RUNTIME_MILLISECONDS}ms`,
  );

  while (Date.now() - startedAt < MAX_RUNTIME_MILLISECONDS) {
    const oldestAudit = await findOldestAuditTimestamp(eligibleBefore);
    if (!oldestAudit) {
      console.info('[scheduled-task:audit-log-archive]: No eligible audit rows remain');
      break;
    }

    const dayStart = utcDayStart(oldestAudit);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    console.debug(
      `[scheduled-task:audit-log-archive]: Processing UTC day ${dayStart.toISOString()} through ${dayEnd.toISOString()}; oldest audit timestamp ${oldestAudit.toISOString()}`,
    );
    const dayPrefix = getDayPrefix(dayStart);
    let suffix = await getNextFileSuffix(client, bucket, dayPrefix);
    let archivedThisDay = false;

    while (Date.now() - startedAt < MAX_RUNTIME_MILLISECONDS) {
      const batch = await archiveBatch(
        client,
        bucket,
        dayStart,
        dayEnd,
        batchLimit,
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

  const elapsedMilliseconds = Date.now() - startedAt;
  if (elapsedMilliseconds >= MAX_RUNTIME_MILLISECONDS) {
    console.warn(
      `[scheduled-task:audit-log-archive]: Stopping at the ${MAX_RUNTIME_MILLISECONDS}ms runtime limit`,
    );
  }
  console.info(
    `[scheduled-task:audit-log-archive]: Archive finished in ${elapsedMilliseconds}ms; archived ${archivedDays} days and deleted ${deletedCount} rows across ${keys.length} files`,
  );
  return { archivedDays, deletedCount, keys };
};
