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
import { handler, HttpError, isHttpError, KhpApiResource, KhpApiResponse } from '../../src';
import each from 'jest-each';
// eslint-disable-next-line prettier/prettier
import type { FlatResource, ImportProgress } from '@tech-matters/types';
import { ScheduledEvent } from 'aws-lambda';
import { addMilliseconds, addSeconds, subHours, subMinutes } from 'date-fns';
import { publishToImportConsumer, ResourceMessage } from '../../src/clientSqs';
import getConfig from '../../src/config';
import { Response } from 'undici';

declare var fetch: typeof import('undici').fetch;

jest.mock('@tech-matters/ssm-cache', () => ({
  getSsmParameter: () => 'static-key',
}));

jest.mock('../../src/clientSqs', () => ({
  publishToImportConsumer: jest.fn(),
}));

jest.mock('../../src/config', () => jest.fn());


const mockFetch: jest.Mock<ReturnType<typeof fetch>> = jest.fn();

const EMPTY_ATTRIBUTES: Omit<FlatResource, 'id' | 'name' | 'lastUpdated' | 'accountSid'> = {
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
};

// @ts-ignore
global.fetch = mockFetch;

const mockPublisher = publishToImportConsumer as jest.MockedFunction<typeof publishToImportConsumer>;
const mockConfiguredPublisher: jest.MockedFunction<ReturnType<typeof publishToImportConsumer>> = jest.fn();


beforeEach(() => {
  jest.resetAllMocks();
  mockConfiguredPublisher.mockResolvedValue(Promise.resolve({} as any));
  mockPublisher.mockReturnValue(mockConfiguredPublisher);
  (getConfig as jest.MockedFunction<typeof getConfig>).mockResolvedValue(MOCK_CONFIG);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baselineDate = parseISO('2020-01-01T00:00:00.000Z');
const testNow = parseISO('2025-01-01T00:00:00.000Z');

type HandlerTestCase = {
  description: string;
  importProgressResponse: ImportProgress | HttpError;
  externalApiResponse: KhpApiResponse | HttpError;
  expectedExternalApiCallParameters: Record<string, string>[];
  expectedPublishedMessages: ResourceMessage[];
};

const generateKhpResource = (updatedAt: Date, resourceId: string): KhpApiResource => ({
  objectId: resourceId,
  name: {
    en:`Resource ${resourceId}`,
  },
  updatedAt: updatedAt.toISOString(),
});

const generateResourceMessage = (lastUpdated: Date, resourceId: string, batchFromDate: Date, remaining: number): ResourceMessage => (
  { 
    accountSid: MOCK_CONFIG.accountSid,
    batch: {
      fromDate: batchFromDate.toISOString(),
      toDate: testNow.toISOString(),
      remaining,
    },
    importedResources: [{
      accountSid: MOCK_CONFIG.accountSid,
      id: resourceId,
      name: `Resource ${resourceId}`,
      lastUpdated: lastUpdated.toISOString(),
      ...EMPTY_ATTRIBUTES,
    }],
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
    description: 'if there is no import progress and the API returns nothing, should send nothing',
    importProgressResponse: { status: 404, statusText: 'Not Found', body: {} },
    externalApiResponse: { data: [], totalResults: 0 },
    expectedExternalApiCallParameters: [
      {
        startDate: new Date(0).toISOString(),
        endDate: testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [],
  }, {
    description: 'if there is no import progress and the API returns all available resources in range, should send them all',
    importProgressResponse: { status: 404, statusText: 'Not Found', body: {} },
    externalApiResponse: { data: [
        generateKhpResource(baselineDate, '1'),
        generateKhpResource(addSeconds(baselineDate, 1), '2'),
      ], totalResults:2 },
    expectedExternalApiCallParameters: [
      {
        startDate: new Date(0).toISOString(),
        endDate: testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(baselineDate, '1', new Date(0), 1),
      generateResourceMessage(addSeconds(baselineDate, 1), '2', new Date(0), 0),
    ],
  }, {
    description: 'if there is import progress and the batch is complete and the API returns all available resources in range, should start another batch and send them all',
    importProgressResponse: { fromDate: new Date(0).toISOString(), toDate: subHours(testNow, 1).toISOString(), remaining: 0, lastProcessedDate: subHours(testNow, 1).toISOString(), lastProcessedId: 'IGNORED' },
    externalApiResponse: { data: [
        generateKhpResource(subMinutes(testNow, 10), '1'),
        generateKhpResource(subMinutes(testNow, 5), '2'),
      ], totalResults:2 },
    expectedExternalApiCallParameters: [
      {
        startDate: addMilliseconds(subHours(testNow, 1), 1).toISOString(),
        endDate: testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(subMinutes(testNow, 10), '1', addMilliseconds(subHours(testNow, 1), 1), 1),
      generateResourceMessage(subMinutes(testNow, 5), '2', addMilliseconds(subHours(testNow, 1), 1), 0),
    ],
  },
];

describe('resources-import-producer handler', () => {
  each(testCases).test('$description', async ({ importProgressResponse, externalApiResponse, expectedExternalApiCallParameters, expectedPublishedMessages }: HandlerTestCase) => {

    mockFetch.mockResolvedValueOnce({
      ok: !isHttpError(importProgressResponse),
      json: () => Promise.resolve(importProgressResponse),
      text: () => Promise.resolve(JSON.stringify(importProgressResponse)),
      status: isHttpError(importProgressResponse) ? importProgressResponse.status : 200,
      statusText: isHttpError(importProgressResponse) ? importProgressResponse.statusText : 'OK',
    } as Response).mockResolvedValue({
      ok: !isHttpError(externalApiResponse),
      json: () => Promise.resolve(externalApiResponse),
      text: () => Promise.resolve(JSON.stringify(externalApiResponse)),
      status: isHttpError(externalApiResponse) ? externalApiResponse.status : 200,
      statusText: isHttpError(externalApiResponse) ? externalApiResponse.statusText : 'OK',
    } as Response);
    await handler({} as ScheduledEvent);
    expect(mockFetch).toHaveBeenCalledTimes(expectedExternalApiCallParameters.length + 1);
    expect(mockFetch.mock.calls[0][0]).toEqual(new URL(`https://development-url/v0/accounts/AC000/resources/import/progress`));
    expect(mockFetch.mock.calls[0][1]).toEqual({
      method: 'GET',
      headers: {
        Authorization: `Basic ${MOCK_CONFIG.internalResourcesApiKey}`,
      },
    });
    expect(mockFetch.mock.calls.length).toEqual(expectedExternalApiCallParameters.length + 1);
    expectedExternalApiCallParameters.forEach((expectedParameters, idx) => {
      const [url, options]: [URL, any] = mockFetch.mock.calls[idx + 1];
      Object.entries(expectedParameters).forEach(([key, value]) => {
        expect(url.searchParams.get(key)).toEqual(value);
      });
      expect(url.searchParams.get('sort')).toEqual('updatedAt');
      expect(url.searchParams.get('dateType')).toEqual('updatedAt');
      expect(url.toString().startsWith(`https://external-url/api/resources`)).toBeTruthy();
      expect(options).toStrictEqual({
        method: 'GET',
        headers: {
          Authorization: MOCK_CONFIG.importApiAuthHeader,
          'x-api-key': MOCK_CONFIG.importApiKey,
        },
      });
    });
    expect(mockConfiguredPublisher).toHaveBeenCalledTimes(expectedPublishedMessages.length);
    expectedPublishedMessages.forEach((expectedMessage, idx) => {
      expect(mockConfiguredPublisher.mock.calls[idx][0]).toEqual(expectedMessage);
    });
  });
});