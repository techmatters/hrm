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
import { handler, HttpError, isHttpError, KhpApiResource, KhpApiResponse } from '../../index';
import each from 'jest-each';
// eslint-disable-next-line prettier/prettier
import type { ImportApiResource, ImportProgress } from '@tech-matters/types';
import { ScheduledEvent } from 'aws-lambda';
import { Response } from 'undici';
import { addMilliseconds, addSeconds, subHours, subMinutes } from 'date-fns';
import { publishToImportConsumer, ResourceMessage } from '../../clientSqs';
const mockFetch: jest.Mock<ReturnType<typeof fetch>> = jest.fn();

const EMPTY_ATTRIBUTES: ImportApiResource['attributes'] = {
  ResourceStringAttributes: [],
  ResourceReferenceStringAttributes: [],
  ResourceBooleanAttributes: [],
  ResourceNumberAttributes: [],
  ResourceDateTimeAttributes: [],
};

const ACCOUNT_SID = 'AC000';

jest.mock('@tech-matters/hrm-ssm-cache', () => ({
  getSsmParameter: () => 'static-key',
}));

jest.mock('../../clientSqs', () => ({
  publishToImportConsumer: jest.fn(),
}));

// @ts-ignore
global.fetch = mockFetch;

const mockPublisher = publishToImportConsumer as jest.MockedFunction<typeof publishToImportConsumer>;

beforeEach(() => {
  jest.resetAllMocks();
  mockPublisher.mockResolvedValue(Promise.resolve({} as any));
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

const generateKhpResource = (updatedAt: Date, resourceId: number): KhpApiResource => ({
  khpReferenceNumber: resourceId,
  name: `Resource ${resourceId}`,
  timestamps: {
    updatedAt: updatedAt.toISOString(),
  },
});

const generateResourceMessage = (updatedAt: Date, resourceId: string, batchFromDate: Date, remaining: number): ResourceMessage => (
  { 
    accountSid: ACCOUNT_SID,
    batch: {

      fromDate: batchFromDate.toISOString(),
      toDate: testNow.toISOString(),
      remaining,
    },
    importedResources: [{
      id: resourceId,
      name: `Resource ${resourceId}`,
      attributes: EMPTY_ATTRIBUTES,
      updatedAt: updatedAt.toISOString(),
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
        fromDate: new Date(0).toISOString(),
        toDate: testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [],
  }, {
    description: 'if there is no import progress and the API returns all available resources in range, should send them all',
    importProgressResponse: { status: 404, statusText: 'Not Found', body: {} },
    externalApiResponse: { data: [
        generateKhpResource(baselineDate, 1),
        generateKhpResource(addSeconds(baselineDate, 1), 2),
      ], totalResults:2 },
    expectedExternalApiCallParameters: [
      {
        fromDate:new Date(0).toISOString(),
        toDate:testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(baselineDate, '1', new Date(0), 2),
      generateResourceMessage(addSeconds(baselineDate, 1), '2', new Date(0), 1),
    ],
  }, {
    description: 'if there is import progress and the batch is complete and the API returns all available resources in range, should start another batch and send them all',
    importProgressResponse: { fromDate: new Date(0).toISOString(), toDate: subHours(testNow, 1).toISOString(), remaining: 0, lastProcessedDate: subHours(testNow, 1).toISOString(), lastProcessedId: 'IGNORED' },
    externalApiResponse: { data: [
        generateKhpResource(subMinutes(testNow, 10), 1),
        generateKhpResource(subMinutes(testNow, 5), 2),
      ], totalResults:2 },
    expectedExternalApiCallParameters: [
      {
        fromDate:addMilliseconds(subHours(testNow, 1), 1).toISOString(),
        toDate:testNow.toISOString(),
        limit: '1000',
      },
    ],
    expectedPublishedMessages: [
      generateResourceMessage(subMinutes(testNow, 10), '1', addMilliseconds(subHours(testNow, 1), 1), 2),
      generateResourceMessage(subMinutes(testNow, 5), '2', addMilliseconds(subHours(testNow, 1), 1), 1),
    ],
  },
];

describe('resources-import-producer-ca handler', () => {
  each(testCases.slice(1)).test('$description', async ({ importProgressResponse, externalApiResponse, expectedExternalApiCallParameters, expectedPublishedMessages }: HandlerTestCase) => {

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
    expect(mockFetch.mock.calls.length).toEqual(expectedExternalApiCallParameters.length + 1);
    expectedExternalApiCallParameters.forEach((expectedParameters, idx) => {
      const url: URL = mockFetch.mock.calls[idx + 1][0];
      Object.entries(expectedParameters).forEach(([key, value]) => {
        expect(url.searchParams.get(key)).toEqual(value);
      });
      expect(url.searchParams.get('sort')).toEqual('updatedAt');
      expect(url.toString().startsWith(`https://external-url/api/resources`)).toBeTruthy();
    });
    expect(mockPublisher).toHaveBeenCalledTimes(expectedPublishedMessages.length);
    expectedPublishedMessages.forEach((expectedMessage, idx) => {
      expect(mockPublisher.mock.calls[idx][0]).toEqual(expectedMessage);
    });
  });
});