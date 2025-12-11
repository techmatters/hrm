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

import addDays from 'date-fns/addDays';
import {
  GetParameterCommand,
  GetParametersByPathCommand,
  ParameterNotFound,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import {
  SsmParameterNotFound,
  addToCache,
  getCachedParameters,
  getSsmParameter,
  ssmCache,
  setCacheDurationMilliseconds,
} from '../../ssmCache';

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

    addToCache(/param/, ssmParam);

    expect(ssmCache.values).toHaveProperty(ssmParam.Name);
    expect(ssmCache?.values?.[ssmParam.Name]?.value).toEqual(ssmParam.Value);
    expect(await getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should not add a value to the cache with non-matching regex', async () => {
    const ssmParam = {
      Name: '/test/badRegex',
      Value: 'value',
    };

    addToCache(/notRight/, ssmParam);

    expect(ssmCache.values).not.toHaveProperty(ssmParam.Name);
    await expect(getSsmParameter(ssmParam.Name)).rejects.toThrow(SsmParameterNotFound);
  });
});

describe('getSsmParameter', () => {
  beforeEach(() => {
    // Reset to default
    ssmCache.values = {};
    jest.clearAllMocks();
    mockSSMClient.resetHistory();
  });
  it('should return the value of a parameter', async () => {
    const ssmParam = {
      Name: '/test/param',
      Value: 'value',
    };

    addToCache(/param/, ssmParam);

    expect(await getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should attempt to load parameter and throw an error if the parameter is not found', async () => {
    await expect(getSsmParameter('/test/badParam')).rejects.toThrow(SsmParameterNotFound);

    expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(1);
  });

  it('should attempt to load parameter and return if it is found', async () => {
    // Mock initial ssm params
    const ssmParam = {
      Name: '/test/newParam',
      Value: 'newValue',
    };

    mockSSMClient.on(GetParameterCommand, { Name: ssmParam.Name }).resolves({
      Parameter: ssmParam,
    });

    await expect(getSsmParameter(ssmParam.Name)).resolves.toEqual(ssmParam.Value);

    expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(1);
  });

  it('should reload parameter after it is expired', async () => {
    setCacheDurationMilliseconds(-1000);

    // Mock initial ssm params
    const ssmParam = {
      Name: '/test/param',
      Value: 'value',
    };
    mockSSMClient.on(GetParameterCommand, { Name: ssmParam.Name }).resolves({
      Parameter: ssmParam,
    });

    await expect(getSsmParameter(ssmParam.Name)).resolves.toEqual(ssmParams[0].Value);

    expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(1);

    const newSsmParam = {
      Name: '/test/param',
      Value: 'newValue',
    };

    mockSSMClient.on(GetParameterCommand, { Name: newSsmParam.Name }).resolves({
      Parameter: newSsmParam,
    });

    await expect(getSsmParameter(newSsmParam.Name)).resolves.toEqual(newSsmParam.Value);

    expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(2);
  });

  it('should cache not found errors for the duration specified in errorCacheDurationMilliseconds', async () => {
    const originalErrorCacheDurationMilliseconds =
      ssmCache.errorCacheDurationMilliseconds;
    try {
      ssmCache.errorCacheDurationMilliseconds = -1000;

      // Mock initial ssm params
      const ssmParam = {
        Name: '/test/param',
        Value: 'value',
      };
      const notFoundError = new ParameterNotFound({ message: 'BONK!', $metadata: {} });
      mockSSMClient
        .on(GetParameterCommand, { Name: ssmParam.Name })
        .rejects(notFoundError);

      await expect(getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(1);

      await expect(getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(2);

      ssmCache.errorCacheDurationMilliseconds = originalErrorCacheDurationMilliseconds;

      delete ssmCache.values[ssmParam.Name];

      await expect(getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(3);

      await expect(getSsmParameter(ssmParam.Name)).rejects.toThrow();

      expect(mockSSMClient.commandCalls(GetParameterCommand).length).toBe(3);
    } finally {
      ssmCache.errorCacheDurationMilliseconds = originalErrorCacheDurationMilliseconds;
    }
  });
});

describe('getCachedParameters', () => {
  beforeEach(() => {
    // Reset to default
    ssmCache.values = {};
    ssmCache.cacheDurationMilliseconds = 3600000;
    delete ssmCache.expiryDate;
  });

  test('Returns only parameter values that match the provided regex', async () => {
    ssmCache.values = {
      valid_parameter_1: {
        value: 'valid_parameter_1_value',
        expiryDate: addDays(new Date(), 10),
      },
      valid_parameter_2: {
        value: 'valid_parameter_2_value',
        expiryDate: addDays(new Date(), 10),
      },
      valid_parameter_3: {
        value: 'valid_parameter_3_value',
        expiryDate: addDays(new Date(), 10),
      },
      invalid_parameter: {
        value: 'invalid_parameter_value',
        expiryDate: addDays(new Date(), 10),
      },
    };

    expect(getCachedParameters(/^valid_parameter_(.+)$/)).toEqual({
      valid_parameter_1: 'valid_parameter_1_value',
      valid_parameter_2: 'valid_parameter_2_value',
      valid_parameter_3: 'valid_parameter_3_value',
    });
  });
  test("Doesn't return errors", async () => {
    ssmCache.values = {
      valid_parameter_1: {
        value: new SsmParameterNotFound('valid_parameter_1'),
        expiryDate: addDays(new Date(), 10),
      },
      valid_parameter_2: {
        value: 'valid_parameter_2_value',
        expiryDate: addDays(new Date(), 10),
      },
    };

    expect(getCachedParameters(/^valid_parameter_(.+)$/)).toEqual({
      valid_parameter_2: 'valid_parameter_2_value',
    });
  });

  test("Doesn't return expired entries", async () => {
    ssmCache.values = {
      valid_parameter_1: {
        value: 'valid_parameter_1_value',
        expiryDate: addDays(new Date(), 10),
      },
      valid_parameter_2: {
        value: 'valid_parameter_2_value',
        expiryDate: addDays(new Date(), -10),
      },
      valid_parameter_3: {
        value: 'valid_parameter_3_value',
        expiryDate: addDays(new Date(), 10),
      },
    };

    expect(getCachedParameters(/^valid_parameter_(.+)$/)).toEqual({
      valid_parameter_1: 'valid_parameter_1_value',
      valid_parameter_3: 'valid_parameter_3_value',
    });
  });

  test("Doesn't return undefined entries", async () => {
    ssmCache.values = {
      valid_parameter_2: undefined,
      valid_parameter_3: {
        value: 'valid_parameter_3_value',
        expiryDate: addDays(new Date(), 10),
      },
    };

    expect(getCachedParameters(/^valid_parameter_(.+)$/)).toEqual({
      valid_parameter_3: 'valid_parameter_3_value',
    });
  });

  test('Returns falsy strings', async () => {
    ssmCache.values = {
      valid_parameter_2: {
        value: '',
        expiryDate: addDays(new Date(), 10),
      },
      valid_parameter_3: {
        value: 'valid_parameter_3_value',
        expiryDate: addDays(new Date(), 10),
      },
    };

    expect(getCachedParameters(/^valid_parameter_(.+)$/)).toEqual({
      valid_parameter_2: '',
      valid_parameter_3: 'valid_parameter_3_value',
    });
  });
});
