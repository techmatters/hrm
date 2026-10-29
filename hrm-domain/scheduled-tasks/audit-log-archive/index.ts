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

import { Upload } from '@aws-sdk/lib-storage';
import { getNativeS3Client } from '@tech-matters/s3-client';
import { Readable } from 'stream';
import { deleteAuditsByIds, streamAuditsToArchive } from './dataAccess';

const MAX_RUNTIME_MILLISECONDS = 60 * 60 * 1000;

type Audit = { id: number; _utcDay: string; [key: string]: unknown };

const utcDayStart = (date: Date): Date => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const getDayKey = (utcDay: string): string =>
  `audit-logs/${utcDay.slice(0, 4)}/${utcDay.slice(5, 7)}/${utcDay}.jsonl`;

const createJsonLinesForDay = (
  iterator: AsyncIterator<Audit>,
  firstAudit: IteratorResult<Audit>,
  utcDay: string,
  ids: number[],
) => {
  let nextAudit = firstAudit;
  const body = Readable.from(
    (async function* () {
      while (!nextAudit.done && nextAudit.value._utcDay === utcDay) {
        const audit = { ...nextAudit.value };
        Reflect.deleteProperty(audit, '_utcDay');
        ids.push(audit.id);
        yield `${JSON.stringify(audit)}\n`;
        nextAudit = await iterator.next();
      }
    })(),
    { objectMode: false },
  );
  return { body, getNextAudit: () => nextAudit };
};

export const archiveAudits = async (
  bucket: string,
  now: Date = new Date(),
): Promise<{ archivedDays: number; deletedCount: number; keys: string[] }> => {
  if (!bucket) {
    throw new Error('An S3 bucket is required to archive audit logs');
  }

  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  const startedAt = Date.now();
  const eligibleBefore = utcDayStart(cutoff);
  const auditStream = await streamAuditsToArchive(eligibleBefore);
  const iterator = (auditStream as AsyncIterable<Audit>)[Symbol.asyncIterator]();
  let nextAudit = await iterator.next();
  let archivedDays = 0;
  let deletedCount = 0;
  const keys: string[] = [];

  try {
    while (!nextAudit.done && Date.now() - startedAt < MAX_RUNTIME_MILLISECONDS) {
      const utcDay = nextAudit.value._utcDay;
      const ids: number[] = [];
      const key = getDayKey(utcDay);
      const { body, getNextAudit } = createJsonLinesForDay(
        iterator,
        nextAudit,
        utcDay,
        ids,
      );

      const upload = new Upload({
        client: getNativeS3Client(),
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/x-ndjson',
        },
      });

      await upload.done();
      nextAudit = getNextAudit();
      deletedCount += await deleteAuditsByIds(ids);
      archivedDays += 1;
      keys.push(key);
    }
  } finally {
    if (!nextAudit.done) {
      (auditStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    }
  }

  return { archivedDays, deletedCount, keys };
};
