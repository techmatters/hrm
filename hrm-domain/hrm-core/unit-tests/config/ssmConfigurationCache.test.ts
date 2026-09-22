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
  getSsmParameter,
  SsmParameterNotFound,
  loadSsmCache as loadSsmCacheRoot,
} from '@tech-matters/ssm-cache';
import { getAccountStaticKey, getFromSSMCache } from '../../config/ssmConfigurationCache';

jest.mock('@tech-matters/ssm-cache', () => {
  const actual = jest.requireActual('@tech-matters/ssm-cache');
  return {
    ...actual,
    loadSsmCache: jest.fn(),
    getSsmParameter: jest.fn(),
  };
});

const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
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
  test('resolves the hrm-service-scoped static key directly when it exists', async () => {
    mockGetSsmParameter.mockResolvedValueOnce('the-key');

    const result = await getAccountStaticKey('ADMIN_HRM');

    expect(result).toBe('the-key');
    expect(mockGetSsmParameter).toHaveBeenCalledWith(
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
    );
  });

  test('prior behavior: falls back to the legacy per-account key path when an account-shaped key is missing', async () => {
    mockGetSsmParameter
      .mockRejectedValueOnce(
        new SsmParameterNotFound('/test/hrm/service/us-east-1/static_key/ACxxx'),
      )
      .mockResolvedValueOnce('legacy-key');

    const result = await getAccountStaticKey('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(result).toBe('legacy-key');
    expect(mockGetSsmParameter).toHaveBeenLastCalledWith(
      '/test/twilio/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/static_key',
    );
  });

  test('prior behavior: a missing non-account key throws instead of silently falling back', async () => {
    mockGetSsmParameter.mockRejectedValueOnce(
      new SsmParameterNotFound('/test/hrm/service/us-east-1/static_key/ADMIN_HRM'),
    );

    await expect(getAccountStaticKey('ADMIN_HRM')).rejects.toThrow(SsmParameterNotFound);
    expect(mockGetSsmParameter).toHaveBeenCalledTimes(1);
  });
});

describe('getFromSSMCache', () => {
  // Prior, unaffected behavior: still used directly by authTokenLookup, and
  // still needs all three parameters for a real account.
  test('fetches the static key, auth token, and permission config together for a real account', async () => {
    mockGetSsmParameter
      .mockResolvedValueOnce('the-key')
      .mockResolvedValueOnce('the-token')
      .mockResolvedValueOnce('the-config');

    const result = await getFromSSMCache('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(result).toEqual({
      staticKey: 'the-key',
      authToken: 'the-token',
      permissionConfig: 'the-config',
    });
  });
});
