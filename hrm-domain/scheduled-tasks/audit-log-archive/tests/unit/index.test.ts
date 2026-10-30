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

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn(),
}));
jest.mock('@tech-matters/s3-client', () => ({
  getNativeS3Client: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ Contents: [], IsTruncated: false }),
  })),
}));
jest.mock('../../dataAccess', () => ({
  deleteAuditsByIds: jest.fn(),
  findOldestAuditTimestamp: jest.fn(),
  streamAuditBatchForDay: jest.fn(),
}));

import { Upload } from '@aws-sdk/lib-storage';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { gunzipSync } from 'zlib';
import {
  deleteAuditsByIds,
  findOldestAuditTimestamp,
  streamAuditBatchForDay,
} from '../../dataAccess';
import { archiveAudits } from '../../index';

const mockedUpload = Upload as unknown as jest.Mock;
const mockedGetNativeS3Client = jest.requireMock('@tech-matters/s3-client')
  .getNativeS3Client as jest.Mock;
const mockedDeleteAuditsByIds = deleteAuditsByIds as jest.Mock;
const mockedFindOldestAuditTimestamp = findOldestAuditTimestamp as jest.Mock;
const mockedStreamAuditBatchForDay = streamAuditBatchForDay as jest.Mock;

const createAuditStream = (audits: { id: number; details?: string }[]) =>
  Readable.from(audits);

describe('archiveAudits', () => {
  const now = new Date('2026-10-28T15:00:00.000Z');
  const uploaded: {
    key: string;
    ids: number[];
    contentType: string;
    contentEncoding: string;
  }[] = [];
  const events: string[] = [];
  let s3Client: { send: jest.Mock };
  let previousBucket: string | undefined;
  let previousRetentionDays: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    previousBucket = process.env.AUDIT_ARCHIVE_BUCKET;
    previousRetentionDays = process.env.AUDIT_ARCHIVE_RETENTION_DAYS;
    process.env.AUDIT_ARCHIVE_BUCKET = 'audit-archive';
    delete process.env.AUDIT_ARCHIVE_RETENTION_DAYS;
    uploaded.length = 0;
    events.length = 0;
    s3Client = {
      send: jest.fn().mockResolvedValue({ Contents: [], IsTruncated: false }),
    };
    mockedGetNativeS3Client.mockReturnValue(s3Client);
    mockedDeleteAuditsByIds.mockImplementation(async (ids: number[]) => {
      events.push(`deleted:${ids.join(',')}`);
      return ids.length;
    });
    mockedFindOldestAuditTimestamp
      .mockResolvedValueOnce(new Date('2024-10-26T12:00:00.000Z'))
      .mockResolvedValueOnce(new Date('2024-10-27T18:00:00.000Z'))
      .mockResolvedValueOnce(null);
    mockedStreamAuditBatchForDay.mockResolvedValue(createAuditStream([]));
    mockedUpload.mockImplementation(
      ({ params }) =>
        ({
          done: async () => {
            const chunks: Buffer[] = [];
            for await (const chunk of params.Body as AsyncIterable<Buffer | string>) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = gunzipSync(Buffer.concat(chunks)).toString();
            const ids = body
              .split('\n')
              .filter(Boolean)
              .map(line => JSON.parse(line).id);
            uploaded.push({
              key: params.Key,
              ids,
              contentType: params.ContentType,
              contentEncoding: params.ContentEncoding,
            });
            events.push(`uploaded:${params.Key}:${ids.join(',')}`);
          },
        }) as unknown as Upload,
    );
  });

  afterEach(() => {
    if (previousBucket === undefined) delete process.env.AUDIT_ARCHIVE_BUCKET;
    else process.env.AUDIT_ARCHIVE_BUCKET = previousBucket;
    if (previousRetentionDays === undefined)
      delete process.env.AUDIT_ARCHIVE_RETENTION_DAYS;
    else process.env.AUDIT_ARCHIVE_RETENTION_DAYS = previousRetentionDays;
  });

  test('writes bounded files per complete UTC day with increasing suffixes and deletes only uploaded IDs', async () => {
    mockedStreamAuditBatchForDay
      .mockResolvedValueOnce(createAuditStream([{ id: 1 }, { id: 2 }, { id: 3 }]))
      .mockResolvedValueOnce(createAuditStream([{ id: 3 }]))
      .mockResolvedValueOnce(createAuditStream([]))
      .mockResolvedValueOnce(createAuditStream([{ id: 4 }]))
      .mockResolvedValueOnce(createAuditStream([]));

    const bucket = 'configured-audit-archive';
    process.env.AUDIT_ARCHIVE_BUCKET = bucket;
    const result = await archiveAudits(now, 2);

    expect(s3Client.send.mock.calls[0][0].input.Bucket).toBe(bucket);
    expect(mockedUpload.mock.calls[0][0].params.Bucket).toBe(bucket);

    expect(mockedStreamAuditBatchForDay).toHaveBeenNthCalledWith(
      1,
      new Date('2024-10-26T00:00:00.000Z'),
      new Date('2024-10-27T00:00:00.000Z'),
      2,
    );
    expect(mockedStreamAuditBatchForDay).toHaveBeenNthCalledWith(
      4,
      new Date('2024-10-27T00:00:00.000Z'),
      new Date('2024-10-28T00:00:00.000Z'),
      2,
    );
    expect(uploaded).toEqual([
      {
        key: 'audit-logs/2024/10/2024-10-26-0000.jsonl.gz',
        ids: [1, 2],
        contentType: 'application/x-ndjson',
        contentEncoding: 'gzip',
      },
      {
        key: 'audit-logs/2024/10/2024-10-26-0001.jsonl.gz',
        ids: [3],
        contentType: 'application/x-ndjson',
        contentEncoding: 'gzip',
      },
      {
        key: 'audit-logs/2024/10/2024-10-27-0000.jsonl.gz',
        ids: [4],
        contentType: 'application/x-ndjson',
        contentEncoding: 'gzip',
      },
    ]);
    expect(mockedDeleteAuditsByIds.mock.calls).toEqual([[[1, 2]], [[3]], [[4]]]);
    expect(events).toEqual([
      'uploaded:audit-logs/2024/10/2024-10-26-0000.jsonl.gz:1,2',
      'deleted:1,2',
      'uploaded:audit-logs/2024/10/2024-10-26-0001.jsonl.gz:3',
      'deleted:3',
      'uploaded:audit-logs/2024/10/2024-10-27-0000.jsonl.gz:4',
      'deleted:4',
    ]);
    expect(result).toEqual({
      archivedDays: 2,
      deletedCount: 4,
      keys: uploaded.map(({ key }) => key),
    });
    expect(s3Client.send).toHaveBeenCalledTimes(2);
    expect(s3Client.send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
  });

  test('continues a partially archived day after its highest existing suffix', async () => {
    mockedFindOldestAuditTimestamp
      .mockReset()
      .mockResolvedValueOnce(new Date('2024-10-26T12:00:00.000Z'))
      .mockResolvedValueOnce(null);
    mockedStreamAuditBatchForDay
      .mockResolvedValueOnce(createAuditStream([{ id: 11 }]))
      .mockResolvedValueOnce(createAuditStream([]));
    s3Client.send.mockResolvedValueOnce({
      Contents: [
        { Key: 'audit-logs/2024/10/2024-10-26-0000.jsonl' },
        { Key: 'audit-logs/2024/10/2024-10-26-0003.jsonl.gz' },
      ],
      IsTruncated: false,
    });

    await archiveAudits(now, 2);

    expect(uploaded[0].key).toBe('audit-logs/2024/10/2024-10-26-0004.jsonl.gz');
  });

  test('queries only fully completed days before the default 730-day cutoff', async () => {
    mockedFindOldestAuditTimestamp.mockReset().mockResolvedValueOnce(null);

    const result = await archiveAudits(now, 2);

    expect(mockedFindOldestAuditTimestamp).toHaveBeenCalledWith(
      new Date('2024-10-28T00:00:00.000Z'),
    );
    expect(mockedStreamAuditBatchForDay).not.toHaveBeenCalled();
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedDeleteAuditsByIds).not.toHaveBeenCalled();
    expect(result).toEqual({ archivedDays: 0, deletedCount: 0, keys: [] });
  });

  test('reads the retention cutoff from AUDIT_ARCHIVE_RETENTION_DAYS', async () => {
    process.env.AUDIT_ARCHIVE_RETENTION_DAYS = '30';
    mockedFindOldestAuditTimestamp.mockReset().mockResolvedValueOnce(null);

    await archiveAudits(now, 2);

    expect(mockedFindOldestAuditTimestamp).toHaveBeenCalledWith(
      new Date('2026-09-28T00:00:00.000Z'),
    );
  });

  test('does not delete IDs when the S3 upload fails', async () => {
    mockedFindOldestAuditTimestamp
      .mockReset()
      .mockResolvedValueOnce(new Date('2024-10-26T12:00:00.000Z'));
    mockedStreamAuditBatchForDay.mockResolvedValueOnce(createAuditStream([{ id: 1 }]));
    const uploadError = new Error('upload failed');
    mockedUpload.mockImplementation(
      ({ params }) =>
        ({
          done: async () => {
            for await (const chunk of params.Body as AsyncIterable<Buffer | string>) {
              void chunk;
            }
            throw uploadError;
          },
        }) as unknown as Upload,
    );

    await expect(archiveAudits(now, 2)).rejects.toBe(uploadError);
    expect(mockedDeleteAuditsByIds).not.toHaveBeenCalled();
  });

  test('stops starting new batches after running for an hour', async () => {
    mockedFindOldestAuditTimestamp
      .mockReset()
      .mockResolvedValue(new Date('2024-10-26T12:00:00.000Z'));
    mockedStreamAuditBatchForDay.mockResolvedValue(
      createAuditStream([{ id: 1 }, { id: 2 }, { id: 3 }]),
    );
    const dateNow = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100 + 60 * 60 * 1000)
      .mockReturnValueOnce(100 + 60 * 60 * 1000)
      .mockReturnValueOnce(100 + 60 * 60 * 1000);

    try {
      const result = await archiveAudits(now, 2);

      expect(mockedStreamAuditBatchForDay).toHaveBeenCalledTimes(1);
      expect(mockedDeleteAuditsByIds).toHaveBeenCalledWith([1, 2]);
      expect(result.deletedCount).toBe(2);
    } finally {
      dateNow.mockRestore();
    }
  });

  test('reads the batch size from AUDIT_ARCHIVE_BATCH_SIZE', async () => {
    const previousValue = process.env.AUDIT_ARCHIVE_BATCH_SIZE;
    process.env.AUDIT_ARCHIVE_BATCH_SIZE = '3';
    mockedFindOldestAuditTimestamp
      .mockReset()
      .mockResolvedValueOnce(new Date('2024-10-26T12:00:00.000Z'))
      .mockResolvedValueOnce(null);
    mockedStreamAuditBatchForDay
      .mockReset()
      .mockResolvedValueOnce(createAuditStream([{ id: 1 }]))
      .mockResolvedValueOnce(createAuditStream([]));

    try {
      await archiveAudits(now);
      expect(mockedStreamAuditBatchForDay).toHaveBeenCalledWith(
        new Date('2024-10-26T00:00:00.000Z'),
        new Date('2024-10-27T00:00:00.000Z'),
        3,
      );
    } finally {
      if (previousValue === undefined) delete process.env.AUDIT_ARCHIVE_BATCH_SIZE;
      else process.env.AUDIT_ARCHIVE_BATCH_SIZE = previousValue;
    }
  });

  test('requires an S3 bucket and a positive batch size', async () => {
    delete process.env.AUDIT_ARCHIVE_BUCKET;
    await expect(archiveAudits(now, 2)).rejects.toThrow('AUDIT_ARCHIVE_BUCKET');
    process.env.AUDIT_ARCHIVE_BUCKET = 'audit-archive';
    await expect(archiveAudits(now, 0)).rejects.toThrow('positive safe integer');
    expect(mockedFindOldestAuditTimestamp).not.toHaveBeenCalled();
  });

  test('rejects invalid retention days before reading audit rows', async () => {
    process.env.AUDIT_ARCHIVE_RETENTION_DAYS = '-1';

    await expect(archiveAudits(now, 2)).rejects.toThrow(
      'AUDIT_ARCHIVE_RETENTION_DAYS must be a non-negative safe integer',
    );
    expect(mockedFindOldestAuditTimestamp).not.toHaveBeenCalled();
  });
});
