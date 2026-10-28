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
import { deleteAuditsBefore, streamAuditsBefore } from './dataAccess';

export const archiveAudits = async (
  bucket: string,
  now: Date = new Date(),
): Promise<{ key: string; deletedCount: number }> => {
  if (!bucket) {
    throw new Error('An S3 bucket is required to archive audit logs');
  }

  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  const key = `audit-logs/${now.toISOString().replace(/[:.]/g, '-')}.jsonl`;
  const auditStream = await streamAuditsBefore(cutoff);
  const jsonLines = Readable.from(
    (async function* () {
      for await (const audit of auditStream as AsyncIterable<unknown>) {
        yield `${JSON.stringify(audit)}\n`;
      }
    })(),
    { objectMode: false },
  );

  const upload = new Upload({
    client: getNativeS3Client(),
    params: {
      Bucket: bucket,
      Key: key,
      Body: jsonLines,
      ContentType: 'application/x-ndjson',
    },
  });

  await upload.done();
  const deletedCount = await deleteAuditsBefore(cutoff);
  return { key, deletedCount };
};
