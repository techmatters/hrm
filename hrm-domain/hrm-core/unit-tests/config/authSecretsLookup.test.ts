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

import { defaultAuthSecretsLookup } from '../../config/authSecretsLookup';
import { getAccountStaticKey } from '@tech-matters/ssm-cache';
import * as ssmConfigurationCache from '../../config/ssmConfigurationCache';

jest.mock('@tech-matters/ssm-cache', () => {
  const actual = jest.requireActual('@tech-matters/ssm-cache');
  return {
    ...actual,
    getAccountStaticKey: jest.fn(),
  };
});
jest.mock('../../config/ssmConfigurationCache');

const mockGetAccountStaticKey = getAccountStaticKey as jest.MockedFunction<
  typeof getAccountStaticKey
>;
const mockGetFromSSMCache = ssmConfigurationCache.getFromSSMCache as jest.MockedFunction<
  typeof ssmConfigurationCache.getFromSSMCache
>;

afterEach(() => {
  jest.resetAllMocks();
  delete process.env.STATIC_KEYS_LOCAL_OVERRIDE;
  delete process.env.AUTH_TOKEN_LOCAL_OVERRIDE;
});

describe('staticKeyLookup', () => {
  // Regression test: a generic key like ADMIN_HRM isn't a Twilio account SID,
  // so it has no auth token or permission config in SSM. Going through
  // getFromSSMCache (which fetches all three unconditionally) throws on
  // those missing parameters and turns every admin request into a 401.
  test('looks up a non-account key (e.g. ADMIN_HRM) directly, without touching the account-shaped bundle', async () => {
    mockGetAccountStaticKey.mockResolvedValueOnce('the-admin-key');

    const result = await defaultAuthSecretsLookup.staticKeyLookup('ADMIN_HRM');

    expect(result).toBe('the-admin-key');
    expect(mockGetAccountStaticKey).toHaveBeenCalledWith('ADMIN_HRM');
    expect(mockGetFromSSMCache).not.toHaveBeenCalled();
  });

  test('still resolves a real account SID static key the same way', async () => {
    mockGetAccountStaticKey.mockResolvedValueOnce('the-account-key');

    const result = await defaultAuthSecretsLookup.staticKeyLookup(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );

    expect(result).toBe('the-account-key');
    expect(mockGetAccountStaticKey).toHaveBeenCalledWith(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );
  });

  test('prior behavior: a local override short-circuits the lookup entirely', async () => {
    process.env.STATIC_KEYS_LOCAL_OVERRIDE = JSON.stringify({
      ADMIN_HRM: 'override-key',
    });

    const result = await defaultAuthSecretsLookup.staticKeyLookup('ADMIN_HRM');

    expect(result).toBe('override-key');
    expect(mockGetAccountStaticKey).not.toHaveBeenCalled();
  });

  test('prior behavior: a genuinely missing key still propagates the error', async () => {
    mockGetAccountStaticKey.mockRejectedValueOnce(new Error('not found'));

    await expect(defaultAuthSecretsLookup.staticKeyLookup('ADMIN_HRM')).rejects.toThrow(
      'not found',
    );
  });
});

describe('authTokenLookup', () => {
  // Unaffected by the static-key fix: real accounts still resolve their auth
  // token through the same account-shaped bundle as before.
  test('prior behavior: resolves via the account-shaped bundle, unchanged', async () => {
    mockGetFromSSMCache.mockResolvedValueOnce({
      staticKey: 'sk',
      authToken: 'the-auth-token',
      permissionConfig: 'pc',
    });

    const result = await defaultAuthSecretsLookup.authTokenLookup(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );

    expect(result).toBe('the-auth-token');
    expect(mockGetFromSSMCache).toHaveBeenCalledWith(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );
  });

  test('prior behavior: a local override short-circuits the lookup entirely', async () => {
    process.env.AUTH_TOKEN_LOCAL_OVERRIDE = JSON.stringify({
      ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx: 'override-token',
    });

    const result = await defaultAuthSecretsLookup.authTokenLookup(
      'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    );

    expect(result).toBe('override-token');
    expect(mockGetFromSSMCache).not.toHaveBeenCalled();
  });
});
