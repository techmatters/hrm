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
import isAfter from 'date-fns/isAfter';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { loadPaginated, loadSsmCache } from '../../src/loadSsmCache';
import * as SsmCache from '../../src/ssmCache';
import { mockClient } from 'aws-sdk-client-mock';

const mockSSMClient = mockClient(SSMClient);

describe('loadSsmCache', () => {
  beforeEach(() => {
    // Reset to default
    mockSSMClient.resetHistory();
    SsmCache.ssmCache.values = {};
    SsmCache.ssmCache.cacheDurationMilliseconds = 3600000;
    delete SsmCache.ssmCache.expiryDate;
  });

  test('loading after cache expired should update expiryDate', async () => {
    const initialExpire = new Date(Date.now() - 1000);
    SsmCache.ssmCache.expiryDate = initialExpire;
    await loadSsmCache({ configs: [] });
    expect(isAfter(SsmCache.ssmCache.expiryDate, initialExpire)).toBeTruthy();
  });

  test('loading after cache expire should cause call fetch new params', async () => {
    const ssmCacheConfig = {
      cacheDurationMilliseconds: -1, // set expire to the past to force update because sometimes this is do fast that milliseconds are the same.
      configs: [
        {
          path: `/test/fake/param`,
          regex: /param/,
        },
      ],
    };

    mockSSMClient.on(GetParametersByPathCommand, {}).resolves({
      Parameters: [
        {
          Name: '/test/fake/param/1',
          Value: 'value',
        },
      ],
    });

    // Ensure first call returns expected params
    await loadSsmCache(ssmCacheConfig);

    expect(mockSSMClient.commandCalls(GetParametersByPathCommand).length).toBe(1);
    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/1');
    expect(SsmCache.ssmCache.values).not.toHaveProperty('/test/fake/param/2');

    mockSSMClient.on(GetParametersByPathCommand, {}).resolves({
      Parameters: [
        {
          Name: '/test/fake/param/1',
          Value: 'value',
        },
        {
          Name: '/test/fake/param/2',
          Value: 'value',
        },
      ],
    });

    // Ensure second call returns new param
    await loadSsmCache(ssmCacheConfig);
    expect(mockSSMClient.commandCalls(GetParametersByPathCommand).length).toBe(2);

    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/1');
    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/2');
  });
});

describe('loadPaginated', () => {
  const credentials = {
    accessKeyId: 'role-key',
    secretAccessKey: 'role-secret',
    sessionToken: 'role-token',
  };

  beforeEach(() => {
    mockSSMClient.reset();
    SsmCache.ssmCache.values = {};
    SsmCache.ssmCache.cacheDurationMilliseconds = 3600000;
  });

  test('reads every page with the given credentials, without changing the shared client or its cache', async () => {
    const accessKeyIdsUsed: string[] = [];
    mockSSMClient.on(GetParametersByPathCommand).callsFake(async (input, getClient) => {
      accessKeyIdsUsed.push((await getClient().config.credentials()).accessKeyId);
      return input.NextToken
        ? { Parameters: [{ Name: '/test/fake/param/2', Value: 'value' }] }
        : {
            Parameters: [{ Name: '/test/fake/param/1', Value: 'value' }],
            NextToken: 'next',
          };
    });

    const sharedClient = SsmCache.getSsmClient();
    await loadPaginated({ path: '/test/fake/', credentials });

    expect(accessKeyIdsUsed).toStrictEqual(['role-key', 'role-key']);
    expect(SsmCache.getCachedParameters(/param/, credentials)).toStrictEqual({
      '/test/fake/param/1': 'value',
      '/test/fake/param/2': 'value',
    });
    expect(SsmCache.getCachedParameters(/param/)).toStrictEqual({});
    expect(SsmCache.getSsmClient()).toBe(sharedClient);
  });

  test('reuses the same client for the same credentials', async () => {
    const clientsUsed = new Set<unknown>();
    mockSSMClient.on(GetParametersByPathCommand).callsFake(async (_input, getClient) => {
      clientsUsed.add(getClient());
      return { Parameters: [] };
    });

    await loadPaginated({ path: '/test/fake/a/', credentials });
    await loadPaginated({ path: '/test/fake/b/', credentials });

    expect(clientsUsed.size).toBe(1);
    expect(clientsUsed.has(SsmCache.getSsmClient(credentials))).toBe(true);
  });
});
