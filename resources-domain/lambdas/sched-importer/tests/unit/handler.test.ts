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
import {
  handler,
  HttpError,
  isHttpError,
  KhpApiResource,
  KhpApiResponse,
} from '../../src';
import each from 'jest-each';
import type {
  FlatResource,
  ImportProgress,
  TimeSequence,
} from '@tech-matters/resources-types';
import { ScheduledEvent } from 'aws-lambda';
import { addSeconds, subHours, subMinutes } from 'date-fns';
import {
  publishToImportConsumer,
  ResourceMessage,
  retrieveUnprocessedMessageCount,
} from '@tech-matters/resources-import-producer';
import getConfig from '../../src/config';

jest.mock('@tech-matters/ssm-cache', () => ({
  getSsmParameter: () => 'static-key',
}));

jest.mock('@tech-matters/resources-import-producer', () => ({
  publishToImportConsumer: jest.fn(),
  retrieveUnprocessedMessageCount: jest.fn(),
}));

jest.mock('../../src/config', () => jest.fn());

const mockFetch: jest.Mock<ReturnType<typeof fetch>> = jest.fn();

const EMPTY_ATTRIBUTES: Omit<FlatResource, 'id' | 'name' | 'lastUpdated' | 'accountSid'> =
  {
    stringAttributes: [],
    referenceStringAttributes: [],
    booleanAttributes: [],
    numberAttributes: [],
    dateTimeAttributes: [],
  };

const MOCK_CONFIG: Awaited<ReturnType<typeof getConfig>> = {
  accountSid: 'AC000',
  internalResourcesBaseUrl: new URL('https://development-url'),
  internalResourcesApiKey: 'MOCK_INTERNAL_API_KEY',
  importApiAuthHeader: 'MOCK_AUTH_HEADER',
  importApiKey: 'MOCK_EXTERNAL_API_KEY',
  importResourcesSqsQueueUrl: new URL('https://queue-url'),
  importApiBaseUrl: new URL('https://external-url'),
  largeMessagesS3Bucket: 'an.s3.bucket',
  maxBatchSize: 6,
  maxApiSize: 3,
  maxRequests: 4,
};

// @ts-ignore
global.fetch = mockFetch;

// Works around the fact that the performance object is read-only in node 18 which breaks useFakeTimers
// https://stackoverflow.com/questions/77694957/typeerror-cannot-assign-to-read-only-property-performance-of-object-object
Object.defineProperty(global, 'performance', {
  writable: true,
});

const mockPublisher = publishToImportConsumer as jest.MockedFunction<
  typeof publishToImportConsumer
>;

const mockRetrieveUnprocessedMessageCount =
  retrieveUnprocessedMessageCount as jest.MockedFunction<
    typeof retrieveUnprocessedMessageCount
  >;
const mockConfiguredPublisher: jest.MockedFunction<
  ReturnType<typeof publishToImportConsumer>
> = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  mockConfiguredPublisher.mockResolvedValue(Promise.resolve({} as any));
  mockPublisher.mockReturnValue(mockConfiguredPublisher);
  mockRetrieveUnprocessedMessageCount.mockResolvedValue(0);
  (getConfig as jest.MockedFunction<typeof getConfig>).mockResolvedValue(MOCK_CONFIG);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baselineDate = parseISO('2020-01-01T00:00:00.000Z');
const testNow = parseISO('2025-01-01T00:00:00.000Z');

type HandlerTestCase = {
  description: string;
  importProgressResponse: ImportProgress | HttpError;
  externalApiResponses: (KhpApiResponse | HttpError)[];
  expectedExternalApiCallParameters: Record<string, string>[];
  expectedPublishedMessages: ResourceMessage[];
};

const timeSequenceFromDate = (date: Date, sequence = 0): TimeSequence =>
  `${date.valueOf()}-${sequence}`;

const generateKhpResource = (updatedAt: Date, resourceId: string): KhpApiResource => ({
  _id: resourceId,
  name: {
    en: `Resource ${resourceId}`,
  },
  updatedAt: updatedAt.toISOString(),
  timeSequence: timeSequenceFromDate(updatedAt),
});

const generateResourceMessage = (
  lastUpdated: Date,
  resourceId: string,
  batchFromSequence: TimeSequence,
  remaining: number,
): ResourceMessage => ({
  accountSid: MOCK_CONFIG.accountSid,
  batch: {
    fromSequence: batchFromSequence,
    toSequence: timeSequenceFromDate(testNow),
    remaining,
  },
  importedResources: [
    {
      accountSid: MOCK_CONFIG.accountSid,
      id: resourceId,
      name: `Resource ${resourceId}`,
      lastUpdated: lastUpdated.toISOString(),
      importSequenceId: timeSequenceFromDate(lastUpdated),
      deletedAt: '',
      ...EMPTY_ATTRIBUTES,
    },
  ],
});

beforeAll(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(testNow);
});

afterAll(() => {
  jest.useRealTimers();
});

const testCases: HandlerTestCase[] = [
  {
    description:
      'if there is no import progress and the API returns nothing, should send nothing',
    importProgressResponse: { status: 404, statusText: 'Not Found', body: {} },
    externalApiResponses: [{ data: [], totalResults: 0 }],
    expectedExternalApiCallParameters: [
      {
        startSequence: '0-0',
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
    ],
    expectedPublishedMessages: [],
  },
  {
    description:
      'if there is no import progress and the API returns all available resources in range, should send them all',
    importProgressResponse: { status: 404, statusText: 'Not Found', body: {} },
    externalApiResponses: [
      {
        data: [
          generateKhpResource(baselineDate, '1'),
          generateKhpResource(addSeconds(baselineDate, 1), '2'),
        ],
        totalResults: 2,
      },
    ],
    expectedExternalApiCallParameters: [
      {
        startSequence: '0-0',
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(baselineDate, '1', '0-0', 1),
      generateResourceMessage(addSeconds(baselineDate, 1), '2', '0-0', 0),
    ],
  },
  {
    description:
      'if there is import progress with no importSequenceId and the API returns all available resources in range, should start another batch and send them all',
    importProgressResponse: {
      fromSequence: '0-0',
      toSequence: timeSequenceFromDate(subHours(testNow, 1)),
      remaining: 0,
      lastProcessedDate: subHours(testNow, 1).toISOString(),
      lastProcessedId: 'IGNORED',
    },
    externalApiResponses: [
      {
        data: [
          generateKhpResource(subMinutes(testNow, 10), '1'),
          generateKhpResource(subMinutes(testNow, 5), '2'),
        ],
        totalResults: 2,
      },
    ],
    expectedExternalApiCallParameters: [
      {
        startSequence: timeSequenceFromDate(subHours(testNow, 1), 1),
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(
        subMinutes(testNow, 10),
        '1',
        timeSequenceFromDate(subHours(testNow, 1), 1),
        1,
      ),
      generateResourceMessage(
        subMinutes(testNow, 5),
        '2',
        timeSequenceFromDate(subHours(testNow, 1), 1),
        0,
      ),
    ],
  },
  {
    description:
      'if there is import progress and there are more resources than the API limit but less than the batch limit, it should keep requesting until it gets them all',
    importProgressResponse: {
      fromSequence: '0-0',
      toSequence: timeSequenceFromDate(subHours(testNow, 1)),
      remaining: 0,
      lastProcessedDate: subHours(testNow, 1).toISOString(),
      lastProcessedId: 'IGNORED',
      importSequenceId: '1234-0',
    },
    externalApiResponses: [
      {
        data: [
          generateKhpResource(subMinutes(testNow, 25), '1'),
          generateKhpResource(subMinutes(testNow, 20), '2'),
          generateKhpResource(subMinutes(testNow, 15), '3'),
        ],
        totalResults: 5,
      },
      {
        data: [
          generateKhpResource(subMinutes(testNow, 10), '4'),
          generateKhpResource(subMinutes(testNow, 5), '5'),
        ],
        totalResults: 2,
      },
    ],
    expectedExternalApiCallParameters: [
      {
        startSequence: '1234-1',
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
      {
        startSequence: timeSequenceFromDate(subMinutes(testNow, 15), 1),
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(subMinutes(testNow, 25), '1', '1234-1', 4),
      generateResourceMessage(subMinutes(testNow, 20), '2', '1234-1', 3),
      generateResourceMessage(subMinutes(testNow, 15), '3', '1234-1', 2),
      generateResourceMessage(
        subMinutes(testNow, 10),
        '4',
        timeSequenceFromDate(subMinutes(testNow, 15), 1),
        1,
      ),
      generateResourceMessage(
        subMinutes(testNow, 5),
        '5',
        timeSequenceFromDate(subMinutes(testNow, 15), 1),
        0,
      ),
    ],
  },
  {
    description:
      'if there is import progress and there are more resources than the batch limit, it should keep requesting until the batch limit is reached',
    importProgressResponse: {
      fromSequence: '0-0',
      toSequence: timeSequenceFromDate(subHours(testNow, 1)),
      remaining: 0,
      lastProcessedDate: subHours(testNow, 1).toISOString(),
      lastProcessedId: 'IGNORED',
      importSequenceId: '1234-0',
    },
    externalApiResponses: [
      {
        data: [
          generateKhpResource(subMinutes(testNow, 25), '1'),
          generateKhpResource(subMinutes(testNow, 20), '2'),
          generateKhpResource(subMinutes(testNow, 15), '3'),
        ],
        totalResults: 100,
      },
      {
        data: [
          generateKhpResource(subMinutes(testNow, 10), '4'),
          generateKhpResource(subMinutes(testNow, 5), '5'),
          generateKhpResource(subMinutes(testNow, 1), '6'),
        ],
        totalResults: 97,
      },
    ],
    expectedExternalApiCallParameters: [
      {
        startSequence: '1234-1',
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
      {
        startSequence: timeSequenceFromDate(subMinutes(testNow, 15), 1),
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(subMinutes(testNow, 25), '1', '1234-1', 99),
      generateResourceMessage(subMinutes(testNow, 20), '2', '1234-1', 98),
      generateResourceMessage(subMinutes(testNow, 15), '3', '1234-1', 97),
      generateResourceMessage(
        subMinutes(testNow, 10),
        '4',
        timeSequenceFromDate(subMinutes(testNow, 15), 1),
        96,
      ),
      generateResourceMessage(
        subMinutes(testNow, 5),
        '5',
        timeSequenceFromDate(subMinutes(testNow, 15), 1),
        95,
      ),
      generateResourceMessage(
        subMinutes(testNow, 1),
        '6',
        timeSequenceFromDate(subMinutes(testNow, 15), 1),
        94,
      ),
    ],
  },
  {
    description:
      'if the API reports inconsistent total counts that could result in an infinite loop, it should stop requesting once the request limit is reached',
    importProgressResponse: {
      fromSequence: '0-0',
      toSequence: timeSequenceFromDate(subHours(testNow, 1)),
      remaining: 0,
      lastProcessedDate: subHours(testNow, 1).toISOString(),
      lastProcessedId: 'IGNORED',
      importSequenceId: '1234-0',
    },
    externalApiResponses: [
      ...new Array(20).fill({
        data: [generateKhpResource(subMinutes(testNow, 25), '1')],
        totalResults: 100,
      }),
    ],
    expectedExternalApiCallParameters: [
      {
        startSequence: '1234-1',
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      },
      ...new Array(3).fill({
        startSequence: timeSequenceFromDate(subMinutes(testNow, 25), 1),
        endSequence: timeSequenceFromDate(testNow),
        limit: MOCK_CONFIG.maxApiSize.toString(),
      }),
    ],
    expectedPublishedMessages: [
      generateResourceMessage(subMinutes(testNow, 25), '1', '1234-1', 99),
      ...new Array(3).fill(
        generateResourceMessage(
          subMinutes(testNow, 25),
          '1',
          timeSequenceFromDate(subMinutes(testNow, 25), 1),
          99,
        ),
      ),
    ],
  },
];

describe('resources-scheduled-importer handler', () => {
  each(testCases).test(
    '$description',
    async ({
      importProgressResponse,
      externalApiResponses,
      expectedExternalApiCallParameters,
      expectedPublishedMessages,
    }: HandlerTestCase) => {
      let mocked = mockFetch.mockResolvedValueOnce({
        ok: !isHttpError(importProgressResponse),
        json: () => Promise.resolve(importProgressResponse),
        text: () => Promise.resolve(JSON.stringify(importProgressResponse)),
        status: isHttpError(importProgressResponse) ? importProgressResponse.status : 200,
        statusText: isHttpError(importProgressResponse)
          ? importProgressResponse.statusText
          : 'OK',
      } as Response);
      externalApiResponses.forEach(externalApiResponse => {
        mocked = mocked.mockResolvedValueOnce({
          ok: !isHttpError(externalApiResponse),
          json: () => Promise.resolve(externalApiResponse),
          text: () => Promise.resolve(JSON.stringify(externalApiResponse)),
          status: isHttpError(externalApiResponse) ? externalApiResponse.status : 200,
          statusText: isHttpError(externalApiResponse)
            ? externalApiResponse.statusText
            : 'OK',
        } as Response);
      });
      await handler({} as ScheduledEvent);
      expect(mockFetch).toHaveBeenCalledTimes(
        expectedExternalApiCallParameters.length + 1,
      );
      expect(mockFetch.mock.calls[0][0]).toEqual(
        new URL(`https://development-url/v0/accounts/AC000/resources/import/progress`),
      );
      expect(mockFetch.mock.calls[0][1]).toEqual({
        method: 'GET',
        headers: {
          Authorization: `Basic ${MOCK_CONFIG.internalResourcesApiKey}`,
        },
      });
      expect(mockFetch.mock.calls.length).toEqual(
        expectedExternalApiCallParameters.length + 1,
      );
      expectedExternalApiCallParameters.forEach((expectedParameters, idx) => {
        const [url, options]: [URL, any] = mockFetch.mock.calls[idx + 1];
        Object.entries(expectedParameters).forEach(([key, value]) => {
          expect(url.searchParams.get(key)).toEqual(value);
        });
        expect(
          url.toString().startsWith(`https://external-url/api/resources`),
        ).toBeTruthy();
        expect(options).toStrictEqual({
          method: 'GET',
          headers: {
            Authorization: MOCK_CONFIG.importApiAuthHeader,
            'x-api-key': MOCK_CONFIG.importApiKey,
          },
          signal: expect.any(AbortSignal),
        });
      });
      expect(mockConfiguredPublisher).toHaveBeenCalledTimes(
        expectedPublishedMessages.length,
      );
      expectedPublishedMessages.forEach((expectedMessage, idx) => {
        expect(mockConfiguredPublisher.mock.calls[idx][0]).toEqual(expectedMessage);
      });
    },
  );
});
