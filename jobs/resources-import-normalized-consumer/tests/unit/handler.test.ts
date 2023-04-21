import parseISO from 'date-fns/parseISO';
import { handler } from '../../index';
import each from 'jest-each';
// eslint-disable-next-line prettier/prettier
import type { ImportApiResource, ImportRequestBody } from '@tech-matters/hrm-types';
import type { SQSEvent } from 'aws-lambda';

const mockFetch = jest.fn();

jest.mock('node-fetch', () => ({
  ...jest.requireActual('node-fetch'),
  __esModule: true,
  default: () => mockFetch(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

const accountSid = 'AC000';

const baselineDate = parseISO('2020-01-01T00:00:00.000Z');

const generateImportResource = (
  resourceIdSuffix: string,
  updatedAt: Date,
  additionalAttributes: Partial<ImportApiResource['attributes']> = {},
): ImportApiResource => ({
  id: `RESOURCE_${resourceIdSuffix}`,
  name: `Resource ${resourceIdSuffix}`,
  updatedAt: updatedAt.toISOString(),
  attributes: {
    ResourceStringAttributes: [
      {
        key: 'STRING_ATTRIBUTE',
        value: 'VALUE',
        language: 'en-US',
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceStringAttributes ?? []),
    ],
    ResourceDateTimeAttributes: [
      {
        key: 'DATETIME_ATTRIBUTE',
        value: baselineDate.toISOString(),
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceDateTimeAttributes ?? []),
    ],
    ResourceNumberAttributes: [
      {
        key: 'NUMBER_ATTRIBUTE',
        value: 1337,
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceNumberAttributes ?? []),
    ],
    ResourceBooleanAttributes: [
      {
        key: 'BOOL_ATTRIBUTE',
        value: true,
        info: { some: 'json' },
      },
      ...(additionalAttributes.ResourceBooleanAttributes ?? []),
    ],
    ResourceReferenceStringAttributes: [
      {
        key: 'REFERENCE_ATTRIBUTE',
        value: 'REFERENCE_VALUE_2',
        language: 'REFERENCE_LANGUAGE',
        list: 'REFERENCE_LIST_1',
      },
      ...(additionalAttributes.ResourceReferenceStringAttributes ?? []),
    ],
  },
});

const generateSQSEventRecord = (messageId: string, body: ImportRequestBody): SQSEvent['Records'][number] => ({
  messageId,
  body: JSON.stringify(body),
  receiptHandle: 'receiptHandle',
  attributes: {
    'ApproximateReceiveCount': '1',
    'SentTimestamp': '1545082649183',
    'SenderId': 'SenderId',
    'ApproximateFirstReceiveTimestamp': '1545082649185',
  },
  messageAttributes: {},
  md5OfBody: 'md5OfBody',
  eventSource: 'aws:sqs',
  eventSourceARN: 'eventSourceARN',
  awsRegion: 'us-east-1',
});

describe('resources-import-normalized-consumer handler', () => {
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
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
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
      expected: { batchItemFailures: [ { itemIdentifier: "message-1" } ] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('100', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
        ],
      },
    },
    {
      when: 'multiple messages',
      condition: 'upsert succeeds',
      expectedOutcouome: 'empty batchItemFailures',
      mockSetup: () => mockFetch
        .mockResolvedValue({ ok: true }),
      expected: { batchItemFailures: [] },
      event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('1', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
          generateSQSEventRecord('message-2', {
            accountSid,
            importedResources: [generateImportResource('2', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
          generateSQSEventRecord('message-3', {
            accountSid,
            importedResources: [generateImportResource('3', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
        ],
      },
    },
    {
      when: 'multiple messages',
      condition: 'one upsert fails',
      expectedOutcouome: 'batchItemFailures containing only the failing one',
      mockSetup: () => mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('Panic!'))
        .mockResolvedValueOnce({ ok: true }),
        expected: { batchItemFailures: [ { itemIdentifier: "message-2" } ] },
        event: {
        Records: [
          generateSQSEventRecord('message-1', {
            accountSid,
            importedResources: [generateImportResource('1', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
          generateSQSEventRecord('message-2', {
            accountSid,
            importedResources: [generateImportResource('2', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
          generateSQSEventRecord('message-3', {
            accountSid,
            importedResources: [generateImportResource('3', baselineDate)],
            batch: {
              fromDate: Date.now().toString(),
              toDate: Date.now().toString(),
              total: 1,
            },
          }),
        ],
      },
    },
  ]).test('when $when, if $condition, should return $expectedOutcouome', async ({ mockSetup, expected, event }) => {
    mockSetup();

    const result = await handler(event);

    expect(result).toMatchObject(expected);
  });
});