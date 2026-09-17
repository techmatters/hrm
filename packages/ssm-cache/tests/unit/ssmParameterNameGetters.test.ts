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

import { SsmParameterNotFound, getSsmParameter } from '../../ssmCache';
import {
  getAccountStaticKey,
  getBeaconApiKeySsmPath,
  getBeaconBaseUrlSsmPath,
  getHrmStaticKeySsmPath,
  getTwilioAccountSidSsmPath,
} from '../../ssmParameterNameGetters';

jest.mock('../../ssmCache', () => {
  const actual = jest.requireActual('../../ssmCache');
  return {
    ...actual,
    getSsmParameter: jest.fn(),
  };
});

const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
>;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('ssm parameter path getters', () => {
  test('builds account sid paths from uppercase short codes', () => {
    expect(getTwilioAccountSidSsmPath('as')).toBe('/test/twilio/AS/account_sid');
  });

  test('builds HRM service static key paths using environment and region', () => {
    expect(getHrmStaticKeySsmPath('ADMIN_HRM')).toBe(
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
    );
  });

  test('preserves beacon helpline code casing supplied by the caller', () => {
    expect(getBeaconBaseUrlSsmPath('USCR')).toBe(
      '/test/hrm/custom-integration/USCR/beacon_base_url',
    );
    expect(getBeaconApiKeySsmPath('UsCr')).toBe(
      '/test/hrm/custom-integration/UsCr/beacon_api_key',
    );
  });
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

  test('falls back to the legacy per-account key path when an account-shaped key is missing', async () => {
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

  test('throws when a missing non-account key has no legacy fallback', async () => {
    mockGetSsmParameter.mockRejectedValueOnce(
      new SsmParameterNotFound('/test/hrm/service/us-east-1/static_key/ADMIN_HRM'),
    );

    await expect(getAccountStaticKey('ADMIN_HRM')).rejects.toThrow(SsmParameterNotFound);
    expect(mockGetSsmParameter).toHaveBeenCalledTimes(1);
  });
});
