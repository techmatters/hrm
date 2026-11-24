/**
 * Copyright (C) 2021-2026 Technology Matters
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
import { addToCache, loadParametersByPath } from '@tech-matters/ssm-cache';
import { getAccountSidsByShortCode } from './accountSids';
import type { AwsCredentials } from './adminRoles';

jest.mock('@tech-matters/ssm-cache', () => ({
  ...jest.requireActual<object>('@tech-matters/ssm-cache'),
  loadParametersByPath: jest.fn(),
}));

const mockLoadParametersByPath = loadParametersByPath as jest.MockedFunction<
  typeof loadParametersByPath
>;

const ACCOUNT_SID = 'AC00000000000000000000000000000000';

// Stands in for the SSM path request, caching one account sid for the credentials it was given
const loadAccountSid =
  (environment: string) =>
  async ({ regex, credentials }: Parameters<typeof loadParametersByPath>[0]) =>
    addToCache(
      regex,
      { Name: `/${environment}/twilio/AS/account_sid`, Value: ACCOUNT_SID },
      credentials,
    );

const newCredentials = (): AwsCredentials => ({
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  sessionToken: 'token',
});

describe('getAccountSidsByShortCode', () => {
  beforeEach(() => {
    mockLoadParametersByPath.mockReset();
  });

  test('provider returning new credentials on each call - reads the values loaded with the credentials it resolved', async () => {
    mockLoadParametersByPath.mockImplementation(loadAccountSid('new-each-call'));

    await expect(
      getAccountSidsByShortCode('new-each-call', async () => newCredentials()),
    ).resolves.toStrictEqual({ AS: ACCOUNT_SID });
  });

  test('path already loaded with other credentials - loads it again for these', async () => {
    mockLoadParametersByPath.mockImplementation(loadAccountSid('other-credentials'));
    const firstCredentials = newCredentials();
    const secondCredentials = newCredentials();

    await getAccountSidsByShortCode('other-credentials', async () => firstCredentials);
    await expect(
      getAccountSidsByShortCode('other-credentials', async () => secondCredentials),
    ).resolves.toStrictEqual({ AS: ACCOUNT_SID });
    expect(mockLoadParametersByPath).toHaveBeenCalledTimes(2);
  });

  test('path already loaded with the same credentials - not loaded again', async () => {
    mockLoadParametersByPath.mockImplementation(loadAccountSid('same-credentials'));
    const credentials = newCredentials();

    await getAccountSidsByShortCode('same-credentials', async () => credentials);
    await expect(
      getAccountSidsByShortCode('same-credentials', async () => credentials),
    ).resolves.toStrictEqual({ AS: ACCOUNT_SID });
    expect(mockLoadParametersByPath).toHaveBeenCalledTimes(1);
  });
});
