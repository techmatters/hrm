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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import getConfig from '../../src/config';

jest.mock('@tech-matters/ssm-cache', () => ({
  getSsmParameter: jest.fn(),
  SsmParameterNotFound: class extends Error {},
}));

const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
>;
const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    helpline_short_code: 'as',
    pending_sqs_queue_url: 'https://queue.example',
    internal_resources_base_url: 'https://internal.example',
  };
  mockGetSsmParameter.mockReset();
  mockGetSsmParameter.mockImplementation(async path => {
    if (path.endsWith('/account_sid')) return 'AC000';
    if (path.endsWith('/base_url')) return 'https://external.example';
    return 'value';
  });
});

afterAll(() => {
  process.env = originalEnv;
});

test('uses the invocation short code and skips KHP-only settings for full imports', async () => {
  delete process.env.internal_resources_base_url;
  const config = await getConfig('usnm', false, false);
  expect(mockGetSsmParameter).toHaveBeenCalledWith(
    '/test/twilio/USNM/account_sid',
    undefined,
    undefined,
  );
  expect(mockGetSsmParameter.mock.calls.map(([path]) => path)).not.toContain(
    '/test/resources/AC000/import_api/api_key',
  );
  expect(mockGetSsmParameter.mock.calls.map(([path]) => path)).not.toEqual(
    expect.arrayContaining([expect.stringContaining('/static_key/')]),
  );
  expect(config.internalResourcesBaseUrl).toBeUndefined();
  expect(config.importApiBaseUrl.toString()).toBe('https://external.example/');
});

test('defaults to the environment short code and reads KHP settings', async () => {
  await getConfig();
  const paths = mockGetSsmParameter.mock.calls.map(([path]) => path);
  expect(paths).toContain('/test/twilio/AS/account_sid');
  expect(paths).toContain('/test/resources/AC000/import_api/api_key');
  expect(paths).toEqual(
    expect.arrayContaining([expect.stringContaining('/static_key/AC000')]),
  );
});
