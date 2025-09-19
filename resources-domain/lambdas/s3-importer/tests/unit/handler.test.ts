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

import { COMPLETED_KEY, handler } from '../../src';
import each from 'jest-each';
import { S3EventRecord } from 'aws-lambda';
import { deleteS3Object, getS3Object, putS3Object } from '@tech-matters/s3-client';
import * as fs from 'node:fs/promises';
import {
  publishToImportConsumer,
  waitForEmptyQueue,
} from '@tech-matters/resources-import-producer';
import { parse } from 'csv-parse';

jest.mock('@tech-matters/s3-client', () => ({
  getS3Object: jest.fn(),
  putS3Object: jest.fn(),
  deleteS3Object: jest.fn(),
}));
jest.mock('@tech-matters/resources-import-producer', () => ({
  waitForEmptyQueue: jest.fn().mockResolvedValue(Promise.resolve()),
  publishToImportConsumer: jest.fn(),
}));
jest.mock('../../src/config', () =>
  jest.fn().mockResolvedValue({
    importResourcesSqsQueueUrl: new URL('https://queue-url'),
    accountSid: 'ACx',
    largeMessagesS3Bucket: 'my-bucket',
  }),
);

// const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockGetS3Object = getS3Object as jest.MockedFunction<typeof getS3Object>;
const mockPutS3Object = putS3Object as jest.MockedFunction<typeof putS3Object>;
const mockDeleteS3Object = deleteS3Object as jest.MockedFunction<typeof deleteS3Object>;
const mockPublishToImportConsumer = publishToImportConsumer as jest.MockedFunction<
  typeof publishToImportConsumer
>;
const mockWaitForEmptyQueue = waitForEmptyQueue as jest.MockedFunction<
  typeof waitForEmptyQueue
>;
const mockConfiguredPublish: jest.MockedFunction<
  ReturnType<typeof publishToImportConsumer>
> = jest.fn();

type HandlerTestCase = {
  description: string;
  csvContentLoader: () => string;
};

let sampleCsvContent: string;

const testCases: HandlerTestCase[] = [
  {
    description: 'stub does not throw',
    csvContentLoader: () => '',
  },
  {
    description: 'sample csv publishes a message per line',
    csvContentLoader: () => sampleCsvContent,
  },
];

const newSampleS3EventRecord = (bucket: string, key: string): S3EventRecord => {
  return {
    s3: {
      object: { key },
      bucket: { name: bucket },
    },
  } as S3EventRecord;
};

beforeAll(async () => {
  sampleCsvContent = await fs.readFile(
    './tests/fixtures/sample-resources-from-usch-2025-07-24.csv',
    { encoding: 'utf8' },
  );
});

beforeEach(() => {
  mockGetS3Object.mockClear();
  mockDeleteS3Object.mockReset();
  mockPutS3Object.mockReset();
  mockWaitForEmptyQueue.mockClear();
  mockConfiguredPublish.mockReset();
  mockConfiguredPublish.mockImplementation(message => {
    console.debug('Published message', JSON.stringify(message, null, 2));
    return Promise.resolve(undefined);
  });
  mockPublishToImportConsumer.mockReset();
  mockPublishToImportConsumer.mockReturnValue(mockConfiguredPublish);
});

describe('resources-scheduled-importer handler', () => {
  each(testCases).test('$description', async ({ csvContentLoader }: HandlerTestCase) => {
    const csvContent = csvContentLoader();
    // Count the number of records in the input CSV
    const csvRecordCounter = parse(csvContent, { from_line: 2 });
    await csvRecordCounter.forEach(() => {});
    const csvRecordCount = csvRecordCounter.info.records;
    mockGetS3Object.mockResolvedValue(csvContent);
    await handler({ Records: [newSampleS3EventRecord('my-bucket', 'the-key')] });
    expect(mockGetS3Object).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      key: 'the-key',
    });
    expect(mockWaitForEmptyQueue).toHaveBeenCalledTimes(1);
    expect(mockConfiguredPublish).toHaveBeenCalledTimes(csvRecordCount);
    expect(mockPutS3Object).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      key: `${COMPLETED_KEY}/the-key`,
      body: csvContent,
      contentType: 'text/csv; charset=utf-8',
    });
    expect(mockDeleteS3Object).toHaveBeenCalledWith({
      bucket: 'my-bucket',
      key: 'the-key',
    });
  });
});
