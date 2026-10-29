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
  getNativeS3Client: jest.fn(() => 's3-client'),
}));
jest.mock('../../dataAccess', () => ({
  deleteAuditsByIds: jest.fn(),
  streamAuditsToArchive: jest.fn(),
}));

import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { deleteAuditsByIds, streamAuditsToArchive } from '../../dataAccess';
import { archiveAudits } from '../../index';

const mockedUpload = Upload as unknown as jest.Mock;
const mockedDeleteAuditsByIds = deleteAuditsByIds as jest.Mock;
const mockedStreamAuditsToArchive = streamAuditsToArchive as jest.Mock;

const createAuditStream = (days: { utcDay: string; startId: number; count: number }[]) =>
  Readable.from(
    (async function* () {
      for (const { utcDay, startId, count } of days) {
        for (let index = 0; index < count; index += 1) {
          yield {
            id: startId + index,
            details: `audit-${startId + index}`,
            _utcDay: utcDay,
          };
        }
      }
    })(),
  ) as NodeJS.ReadableStream;

describe('archiveAudits', () => {
  const now = new Date('2026-10-28T15:00:00.000Z');
  const uploaded: { key: string; ids: number[]; includesUtcDay: boolean }[] = [];
  const events: string[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    uploaded.length = 0;
    events.length = 0;
    mockedDeleteAuditsByIds.mockImplementation(async (ids: number[]) => {
      events.push(`deleted:${ids.length}`);
      return ids.length;
    });
    mockedStreamAuditsToArchive.mockResolvedValue(createAuditStream([]));
    mockedUpload.mockImplementation(
      ({ params }) =>
        ({
          done: async () => {
            let body = '';
            for await (const chunk of params.Body as AsyncIterable<Buffer | string>) {
              body += Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
            }
            const records = body
              .split('\n')
              .filter(Boolean)
              .map(line => JSON.parse(line));
            uploaded.push({
              key: params.Key,
              ids: records.map(record => record.id),
              includesUtcDay: records.some(record => '_utcDay' in record),
            });
            events.push(`uploaded:${params.Key}`);
          },
        }) as unknown as Upload,
    );
  });

  test('archives complete UTC days as separate streamed files and deletes only uploaded IDs', async () => {
    mockedStreamAuditsToArchive.mockResolvedValueOnce(
      createAuditStream([
        { utcDay: '2024-10-26', startId: 1, count: 10_000 },
        { utcDay: '2024-10-27', startId: 10_001, count: 2 },
      ]),
    );

    const result = await archiveAudits('audit-archive', now);

    expect(mockedStreamAuditsToArchive).toHaveBeenCalledWith(
      new Date('2024-10-28T00:00:00.000Z'),
    );
    expect(uploaded.map(({ key, ids }) => [key, ids.length])).toEqual([
      ['audit-logs/2024/10/2024-10-26.jsonl', 10_000],
      ['audit-logs/2024/10/2024-10-27.jsonl', 2],
    ]);
    expect(uploaded[0].ids).toEqual(
      Array.from({ length: 10_000 }, (_, index) => index + 1),
    );
    expect(uploaded[1].ids).toEqual([10_001, 10_002]);
    expect(uploaded.every(({ includesUtcDay }) => !includesUtcDay)).toBe(true);
    expect(mockedDeleteAuditsByIds).toHaveBeenNthCalledWith(
      1,
      Array.from({ length: 10_000 }, (_, index) => index + 1),
    );
    expect(mockedDeleteAuditsByIds).toHaveBeenNthCalledWith(2, [10_001, 10_002]);
    expect(events).toEqual([
      'uploaded:audit-logs/2024/10/2024-10-26.jsonl',
      'deleted:10000',
      'uploaded:audit-logs/2024/10/2024-10-27.jsonl',
      'deleted:2',
    ]);
    expect(result).toEqual({
      archivedDays: 2,
      deletedCount: 10_002,
      keys: [
        'audit-logs/2024/10/2024-10-26.jsonl',
        'audit-logs/2024/10/2024-10-27.jsonl',
      ],
    });
  });

  test('queries only complete UTC days before the two-year cutoff', async () => {
    const result = await archiveAudits('audit-archive', now);

    expect(mockedStreamAuditsToArchive).toHaveBeenCalledWith(
      new Date('2024-10-28T00:00:00.000Z'),
    );
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedDeleteAuditsByIds).not.toHaveBeenCalled();
    expect(result).toEqual({ archivedDays: 0, deletedCount: 0, keys: [] });
  });

  test('does not delete IDs when the S3 upload fails', async () => {
    mockedStreamAuditsToArchive.mockResolvedValueOnce(
      createAuditStream([{ utcDay: '2024-10-26', startId: 1, count: 2 }]),
    );
    const uploadError = new Error('upload failed');
    mockedUpload.mockImplementation(
      () =>
        ({
          done: async () => {
            throw uploadError;
          },
        }) as unknown as Upload,
    );

    await expect(archiveAudits('audit-archive', now)).rejects.toBe(uploadError);
    expect(mockedDeleteAuditsByIds).not.toHaveBeenCalled();
  });

  test('stops starting new days after running for an hour', async () => {
    mockedStreamAuditsToArchive.mockResolvedValueOnce(
      createAuditStream([
        { utcDay: '2024-10-26', startId: 1, count: 1 },
        { utcDay: '2024-10-27', startId: 2, count: 1 },
      ]),
    );
    const dateNow = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100 + 60 * 60 * 1000);

    try {
      const result = await archiveAudits('audit-archive', now);

      expect(mockedUpload).toHaveBeenCalledTimes(1);
      expect(mockedDeleteAuditsByIds).toHaveBeenCalledTimes(1);
      expect(mockedDeleteAuditsByIds).toHaveBeenCalledWith([1]);
      expect(result.archivedDays).toBe(1);
    } finally {
      dateNow.mockRestore();
    }
  });

  test('requires an S3 bucket', async () => {
    await expect(archiveAudits('', now)).rejects.toThrow('An S3 bucket is required');
    expect(mockedStreamAuditsToArchive).not.toHaveBeenCalled();
  });
});
