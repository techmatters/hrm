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

import { isAfter } from 'date-fns';
import {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
  ParameterNotFound,
} from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import * as SsmCache from '../../index';

const mockSSMClient = mockClient(SSMClient);

const ssmParams = [
  {
    Name: '/test/param',
    Value: 'value',
  },
];

mockSSMClient.on(GetParameterCommand, {}).resolves({
  Parameter: ssmParams[0],
});

mockSSMClient.on(GetParametersByPathCommand, {}).resolves({
  Parameters: ssmParams,
});

describe('addToCache', () => {
  it('should add a value to the cache with matching regex', async () => {
    const ssmParam = {
      Name: '/test/param',
      Value: 'value',
    };

    SsmCache.addToCache(/param/, ssmParam);

    expect(SsmCache.ssmCache.values).toHaveProperty(ssmParam.Name);
    expect(SsmCache.ssmCache?.values?.[ssmParam.Name]?.value).toEqual(ssmParam.Value);
    expect(await SsmCache.getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should not add a value to the cache with non-matching regex', async () => {
    const ssmParam = {
      Name: '/test/badRegex',
      Value: 'value',
    };

    SsmCache.addToCache(/notRight/, ssmParam);

    expect(SsmCache.ssmCache.values).not.toHaveProperty(ssmParam.Name);
    await expect(SsmCache.getSsmParameter(ssmParam.Name)).rejects.toThrow(
      SsmCache.SsmParameterNotFound,
    );
  });
});

describe('getSsmParameter', () => {
  beforeEach(() => {
    // Reset to default
    SsmCache.ssmCache.values = {};
    jest.clearAllMocks();
  });
  it('should return the value of a parameter', async () => {
    const ssmParam = {
      Name: '/test/param',
      Value: 'value',
    };

    SsmCache.addToCache(/param/, ssmParam);

    expect(await SsmCache.getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should attempt to load parameter and throw an error if the parameter is not found', async () => {
    const loadParameterSpy = jest.spyOn(SsmCache, 'loadParameter');

    await expect(SsmCache.getSsmParameter('/test/badParam')).rejects.toThrow(
      SsmCache.SsmParameterNotFound,
    );

    expect(loadParameterSpy).toHaveBeenCalledTimes(1);
  });

  it('should attempt to load parameter and return if it is found', async () => {
    const loadParameterSpy = jest.spyOn(SsmCache, 'loadParameter');

    // Mock initial ssm params
    const ssmParam = {
      Name: '/test/newParam',
      Value: 'newValue',
    };

    mockSSMClient.on(GetParameterCommand, { Name: ssmParam.Name }).resolves({
      Parameter: ssmParam,
    });

    await expect(SsmCache.getSsmParameter(ssmParam.Name)).resolves.toEqual(
      ssmParam.Value,
    );

    expect(loadParameterSpy).toHaveBeenCalledTimes(1);
  });

  it('should reload parameter after it is expired', async () => {
    const loadParameterSpy = jest.spyOn(SsmCache, 'loadParameter');

    SsmCache.setCacheDurationMilliseconds(-1000);

    // Mock initial ssm params
    const ssmParam = {
      Name: '/test/param',
      Value: 'value',
    };
    mockSSMClient.on(GetParameterCommand, { Name: ssmParam.Name }).resolves({
      Parameter: ssmParam,
    });

    await expect(SsmCache.getSsmParameter(ssmParam.Name)).resolves.toEqual(
      ssmParams[0].Value,
    );

    expect(loadParameterSpy).toHaveBeenCalledTimes(1);

    const newSsmParam = {
      Name: '/test/param',
      Value: 'newValue',
    };

    mockSSMClient.on(GetParameterCommand, { Name: newSsmParam.Name }).resolves({
      Parameter: newSsmParam,
    });

    await expect(SsmCache.getSsmParameter(newSsmParam.Name)).resolves.toEqual(
      newSsmParam.Value,
    );

    expect(loadParameterSpy).toHaveBeenCalledTimes(2);
  });

  it('should cache not found errors for the duration specified in errorCacheDurationMilliseconds', async () => {
    const loadParameterSpy = jest.spyOn(SsmCache, 'loadParameter');
    const originalErrorCacheDurationMilliseconds =
      SsmCache.ssmCache.errorCacheDurationMilliseconds;
    try {
      SsmCache.ssmCache.errorCacheDurationMilliseconds = -1000;

      // Mock initial ssm params
      const ssmParam = {
        Name: '/test/param',
        Value: 'value',
      };
      const notFoundError = new ParameterNotFound({ message: 'BONK!', $metadata: {} });
      mockSSMClient
        .on(GetParameterCommand, { Name: ssmParam.Name })
        .rejects(notFoundError);

      await expect(SsmCache.getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(loadParameterSpy).toHaveBeenCalledTimes(1);

      await expect(SsmCache.getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(loadParameterSpy).toHaveBeenCalledTimes(2);

      SsmCache.ssmCache.errorCacheDurationMilliseconds =
        originalErrorCacheDurationMilliseconds;

      delete SsmCache.ssmCache.values[ssmParam.Name];

      await expect(SsmCache.getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(loadParameterSpy).toHaveBeenCalledTimes(3);

      await expect(SsmCache.getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(loadParameterSpy).toHaveBeenCalledTimes(3);
    } finally {
      SsmCache.ssmCache.errorCacheDurationMilliseconds =
        originalErrorCacheDurationMilliseconds;
    }
  });
});

describe('loadSsmCache', () => {
  beforeEach(() => {
    // Reset to default
    SsmCache.ssmCache.values = {};
    SsmCache.ssmCache.cacheDurationMilliseconds = 3600000;
    delete SsmCache.ssmCache.expiryDate;
  });

  it('loading after cache expired should update expiryDate', async () => {
    const initialExpire = new Date(Date.now() - 1000);
    SsmCache.ssmCache.expiryDate = initialExpire;
    await SsmCache.loadSsmCache({ configs: [] });
    expect(isAfter(SsmCache.ssmCache.expiryDate, initialExpire)).toBeTruthy();
  });

  it('loading after cache expire should cause call fetch new params', async () => {
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

    const loadPaginatedSpy = jest.spyOn(SsmCache, 'loadPaginated');

    // Ensure first call returns expected params
    await SsmCache.loadSsmCache(ssmCacheConfig);
    expect(loadPaginatedSpy).toHaveBeenCalledTimes(1);
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
    await SsmCache.loadSsmCache(ssmCacheConfig);
    expect(loadPaginatedSpy).toHaveBeenCalledTimes(2);

    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/1');
    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/2');
  });
});
