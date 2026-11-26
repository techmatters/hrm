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

import { isErr, isOk } from '@tech-matters/types';
import { createKhpClient } from '../../src/clients/khp';
import { createNamiClient } from '../../src/clients/nami';
import type { Config } from '../../src/config';

const config: Config = {
  accountSid: 'AC000',
  internalResourcesBaseUrl: new URL('https://internal.example'),
  internalResourcesApiKey: 'internal-key',
  importApiAuthHeader: 'Basic example',
  importApiKey: 'external-key',
  importResourcesSqsQueueUrl: new URL('https://queue.example'),
  importApiBaseUrl: new URL('https://external.example'),
  largeMessagesS3Bucket: 'bucket',
  maxBatchSize: 10,
  maxApiSize: 2,
  maxRequests: 2,
};

const mockFetch = jest.fn();
const originalFetch = global.fetch;
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

beforeAll(() => {
  global.fetch = mockFetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  mockFetch.mockReset();
});

test('KHP returns a success Result with the next sequence', async () => {
  const resource = {
    _id: 'one',
    name: { en: 'One' },
    updatedAt: '2025-01-01',
    timeSequence: '100-0',
  };
  mockFetch.mockResolvedValueOnce(ok({ data: [resource], totalResults: 2 }));
  const result = await createKhpClient(config)('0-0', '200-0', 2);
  expect(isOk(result)).toBe(true);
  expect(result.unwrap()).toEqual({
    data: [resource],
    totalResults: 2,
    nextFrom: '100-1',
  });
});

test('NAMI returns a success Result with deleted and active records', async () => {
  mockFetch.mockResolvedValueOnce(ok([{ slug: 'support' }])).mockResolvedValueOnce(
    ok({
      resources: [{ id: 1, name: 'One' }],
      deleted: [{ id: 2, deleted_at: '2026-10-05T12:31:59Z' }],
    }),
  );
  const result = await createNamiClient(config)('', '', 1);
  expect(isOk(result)).toBe(true);
  expect(result.unwrap()).toEqual({
    data: [
      { id: 2, deleted_at: '2026-10-05T12:31:59Z' },
      { id: 1, name: 'One' },
    ],
    totalResults: 2,
  });
});

test.each([createKhpClient, createNamiClient])(
  'returns HTTP failures as error Results',
  async createClient => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'denied',
    });
    const result = await createClient(config)('', '', 1);
    expect(isErr(result)).toBe(true);
    expect(result).toMatchObject({
      error: 'HttpError',
      message: '403 (Forbidden). Response body: denied',
    });
  },
);

test.each([createKhpClient, createNamiClient])(
  'returns fetch and JSON exceptions as error Results',
  async createClient => {
    mockFetch.mockRejectedValueOnce(new Error('network unavailable'));
    const network = await createClient(config)('', '', 1);
    expect(network).toMatchObject({ status: 'error', message: 'network unavailable' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('invalid JSON');
      },
    });
    const invalidJson = await createClient(config)('', '', 1);
    expect(invalidJson).toMatchObject({ status: 'error', message: 'invalid JSON' });
  },
);

test('NAMI returns validation and configuration failures as error Results', async () => {
  mockFetch.mockResolvedValueOnce(ok([{ slug: 'bad,slug' }]));
  const invalid = await createNamiClient(config)('', '', 1);
  expect(invalid).toMatchObject({ status: 'error', error: 'InvalidResponse' });

  const insecure = await createNamiClient({
    ...config,
    importApiBaseUrl: new URL('http://external.example'),
  })('', '', 1);
  expect(insecure).toMatchObject({ status: 'error', error: 'ConfigurationError' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('NAMI returns an error Result if the resources request fails', async () => {
  mockFetch.mockResolvedValueOnce(ok([{ slug: 'support' }])).mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Server Error',
    text: async () => 'unavailable',
  } as Response);
  const result = await createNamiClient(config)('', '', 1);
  expect(result).toMatchObject({
    status: 'error',
    error: 'HttpError',
    message: '500 (Server Error). Response body: unavailable',
  });
});
