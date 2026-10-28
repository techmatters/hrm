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
  deleteAuditsBefore: jest.fn(),
  streamAuditsBefore: jest.fn(),
}));

import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { deleteAuditsBefore, streamAuditsBefore } from '../../dataAccess';
import { archiveAudits } from '../../index';

const mockedUpload = Upload as unknown as jest.Mock;
const mockedDeleteAuditsBefore = deleteAuditsBefore as jest.Mock;
const mockedStreamAuditsBefore = streamAuditsBefore as jest.Mock;

describe('archiveAudits', () => {
  const now = new Date('2026-10-28T00:00:00.000Z');
  const expectedCutoff = new Date('2024-10-28T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStreamAuditsBefore.mockResolvedValue(
      Readable.from([{ id: 1 }, { id: 2 }]) as NodeJS.ReadableStream,
    );
    mockedDeleteAuditsBefore.mockResolvedValue(2);
    mockedUpload.mockImplementation(
      ({ params }) =>
        ({
          done: async () => {
            const contents: string[] = [];
            for await (const chunk of params.Body as AsyncIterable<string>) {
              contents.push(Buffer.isBuffer(chunk) ? chunk.toString() : chunk);
            }
            expect(contents).toEqual(['{"id":1}\n', '{"id":2}\n']);
          },
        }) as unknown as Upload,
    );
  });

  test('uploads old audits as JSONL before deleting them', async () => {
    const result = await archiveAudits('audit-archive', now);

    expect(mockedStreamAuditsBefore).toHaveBeenCalledWith(expectedCutoff);
    expect(mockedUpload).toHaveBeenCalledWith({
      client: 's3-client',
      params: expect.objectContaining({
        Bucket: 'audit-archive',
        Key: 'audit-logs/2026-10-28T00-00-00-000Z.jsonl',
        ContentType: 'application/x-ndjson',
      }),
    });
    expect(mockedDeleteAuditsBefore).toHaveBeenCalledWith(expectedCutoff);
    expect(result).toEqual({
      key: 'audit-logs/2026-10-28T00-00-00-000Z.jsonl',
      deletedCount: 2,
    });
  });

  test('does not delete audits when the S3 upload fails', async () => {
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
    expect(mockedDeleteAuditsBefore).not.toHaveBeenCalled();
  });

  test('requires an S3 bucket', async () => {
    await expect(archiveAudits('', now)).rejects.toThrow('An S3 bucket is required');
    expect(mockedStreamAuditsBefore).not.toHaveBeenCalled();
  });
});
