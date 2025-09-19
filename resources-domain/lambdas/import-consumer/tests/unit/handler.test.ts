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

import parseISO from 'date-fns/parseISO';
import { handler } from '../../index';
import each from 'jest-each';
import type {
  FlatResource,
  ImportRequestBody,
  TimeSequence,
} from '@tech-matters/resources-types';
import type { SQSEvent } from 'aws-lambda';

const mockFetch = jest.fn();

jest.mock('@tech-matters/ssm-cache', () => ({
  getSsmParameter: () => 'static-key',
}));

// @ts-ignore
global.fetch = mockFetch;

beforeEach(() => {
  jest.resetAllMocks();
});

const timeSequenceFromDate = (date: Date, sequence = 0): TimeSequence =>
  `${date.valueOf()}-${sequence}`;

const accountSid = 'AC000';

const baselineDate = parseISO('2020-01-01T00:00:00.000Z');

const generateImportResource = (
  resourceIdSuffix: string,
  lastUpdated: Date,
  additionalAttributes: Partial<FlatResource> = {},
): FlatResource => ({
  accountSid,
  id: `RESOURCE_${resourceIdSuffix}`,
  name: `Resource ${resourceIdSuffix}`,
  lastUpdated: lastUpdated.toISOString(),
  stringAttributes: [
    {
      key: 'STRING_ATTRIBUTE',
      value: 'VALUE',
      language: 'en-US',
      info: { some: 'json' },
    },
    ...(additionalAttributes.stringAttributes ?? []),
  ],
  dateTimeAttributes: [
    {
      key: 'DATETIME_ATTRIBUTE',
      value: baselineDate.toISOString(),
      info: { some: 'json' },
    },
    ...(additionalAttributes.dateTimeAttributes ?? []),
  ],
  numberAttributes: [
    {
      key: 'NUMBER_ATTRIBUTE',
      value: 1337,
      info: { some: 'json' },
    },
    ...(additionalAttributes.numberAttributes ?? []),
  ],
  booleanAttributes: [
    {
      key: 'BOOL_ATTRIBUTE',
      value: true,
      info: { some: 'json' },
    },
    ...(additionalAttributes.booleanAttributes ?? []),
  ],
  referenceStringAttributes: [
    {
      key: 'REFERENCE_ATTRIBUTE',
      value: 'REFERENCE_VALUE_2',
      language: 'REFERENCE_LANGUAGE',
      list: 'REFERENCE_LIST_1',
    },
    ...(additionalAttributes.referenceStringAttributes ?? []),
  ],
});

const generateSQSEventRecord = (
  messageId: string,
  body: ImportRequestBody & { accountSid: string },
): SQSEvent['Records'][number] => ({
  messageId,
  body: JSON.stringify(body),
  receiptHandle: 'receiptHandle',
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1545082649183',
    SenderId: 'SenderId',
    ApproximateFirstReceiveTimestamp: '1545082649185',
  },
  messageAttributes: {},
  md5OfBody: 'md5OfBody',
  eventSource: 'aws:sqs',
  eventSourceARN: 'eventSourceARN',
  awsRegion: 'us-east-1',
});

describe('resources-import-consumer handler', () => {
  each([
    {
      when: 'single message',
      condition: 'upsert succeeds',
      expectedOutcouome: 'empty batchItemFailures',
      mockSetup: () => mockFetch.mockResolvedValueOnce({ ok: true }),
      expected: { batchItemFailures: [] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('100', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
        ],
      },
    },
    {
      when: 'single message',
      condition: 'upsert fails',
      expectedOutcouome: 'batchItemFailures with the message',
      mockSetup: () => mockFetch.mockRejectedValueOnce(new Error('Panic!')),
      expected: { batchItemFailures: [{ itemIdentifier: 'message-1' }] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('100', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
        ],
      },
    },
    {
      when: 'multiple messages',
      condition: 'upsert succeeds',
      expectedOutcouome: 'empty batchItemFailures',
      mockSetup: () => mockFetch.mockResolvedValue({ ok: true }),
      expected: { batchItemFailures: [] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('1', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
          generateSQSEventRecord('message-2', {
            accountSid,
            importedResources: [generateImportResource('2', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
          generateSQSEventRecord('message-3', {
            accountSid,
            importedResources: [generateImportResource('3', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
        ],
      },
    },
    {
      when: 'multiple messages',
      condition: 'one upsert fails',
      expectedOutcouome: 'batchItemFailures containing only the failing one',
      mockSetup: () =>
        mockFetch
          .mockResolvedValueOnce({ ok: true })
          .mockRejectedValueOnce(new Error('Panic!'))
          .mockResolvedValueOnce({ ok: true }),
      expected: { batchItemFailures: [{ itemIdentifier: 'message-2' }] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('1', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
          generateSQSEventRecord('message-2', {
            accountSid,
            importedResources: [generateImportResource('2', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
          generateSQSEventRecord('message-3', {
            accountSid,
            importedResources: [generateImportResource('3', baselineDate)],
            batch: {
              fromSequence: timeSequenceFromDate(new Date()),
              toSequence: timeSequenceFromDate(new Date()),
              remaining: 1,
            },
          }),
        ],
      },
    },
  ]).test(
    'when $when, if $condition, should return $expectedOutcouome',
    async ({ mockSetup, expected, event }) => {
      mockSetup();

      const result = await handler(event);

      expect(result).toMatchObject(expected);
    },
  );
});
