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

import {
  getAccountStaticKey,
  getPermissionConfig,
  getTwilioAuthToken,
} from '@tech-matters/aselo-config';
import { loadSsmCache as loadSsmCacheRoot } from '@tech-matters/ssm-cache';
import { getFromSSMCache } from '../../config/ssmConfigurationCache';

jest.mock('@tech-matters/aselo-config', () => ({
  ...(jest.requireActual('@tech-matters/aselo-config') as Record<string, unknown>),
  getAccountStaticKey: jest.fn(),
  getPermissionConfig: jest.fn(),
  getTwilioAuthToken: jest.fn(),
}));
jest.mock('@tech-matters/ssm-cache', () => ({
  ...(jest.requireActual('@tech-matters/ssm-cache') as Record<string, unknown>),
  loadSsmCache: jest.fn(),
}));

const mockGetAccountStaticKey = getAccountStaticKey as jest.MockedFunction<
  typeof getAccountStaticKey
>;
const mockGetPermissionConfig = getPermissionConfig as jest.MockedFunction<
  typeof getPermissionConfig
>;
const mockGetTwilioAuthToken = getTwilioAuthToken as jest.MockedFunction<
  typeof getTwilioAuthToken
>;
const mockLoadSsmCache = loadSsmCacheRoot as jest.MockedFunction<typeof loadSsmCacheRoot>;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  mockLoadSsmCache.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('getAccountStaticKey', () => {
  // Prior, unaffected behavior: still used directly by authTokenLookup, and
  // still needs all three parameters for a real account.
  test('fetches the static key, auth token, and permission config together for a real account', async () => {
    mockGetAccountStaticKey.mockResolvedValueOnce('the-key');
    mockGetTwilioAuthToken.mockResolvedValueOnce('the-token');
    mockGetPermissionConfig.mockResolvedValueOnce('the-config');

    const result = await getFromSSMCache('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(result).toEqual({
      staticKey: 'the-key',
      authToken: 'the-token',
      permissionConfig: 'the-config',
    });
    expect(mockLoadSsmCache).toHaveBeenCalled();
    expect(mockGetAccountStaticKey).toHaveBeenCalledWith(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );
  });
});
