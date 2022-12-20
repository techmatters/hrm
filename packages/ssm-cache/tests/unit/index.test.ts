import { isAfter } from 'date-fns';

import * as SsmCache from '../../index';

let ssmParams = [
  {
    Name: '/localstack/test/param',
    Value: 'value',
  },
];

jest.mock('aws-sdk', () => {
  const SSMMocked = {
    getParametersByPath: () => {
      return {
        promise: jest.fn().mockResolvedValue({
          Parameters: ssmParams,
        }),
      };
    },
    promise: jest.fn(),
  };
  return {
    SSM: jest.fn(() => SSMMocked),
  };
});

describe('addToCache', () => {
  it('should add a value to the cache with matching regex', () => {
    const ssmParam = {
      Name: '/localstack/test/param',
      Value: 'value',
    };

    SsmCache.addToCache(/param/, ssmParam);

    expect(SsmCache.ssmCache.values).toHaveProperty(ssmParam.Name);
    expect(SsmCache.ssmCache.values[ssmParam.Name]).toEqual(ssmParam.Value);
    expect(SsmCache.getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should not add a value to the cache with non-matching regex', () => {
    const ssmParam = {
      Name: '/localstack/test/badRegex',
      Value: 'value',
    };

    SsmCache.addToCache(/notRight/, ssmParam);

    expect(SsmCache.ssmCache.values).not.toHaveProperty(ssmParam.Name);
    expect(() => SsmCache.getSsmParameter(ssmParam.Name)).toThrow(SsmCache.SsmParameterNotFound);
  });
});

describe('loadCache', () => {
  beforeEach(() => {
    // Reset to default
    SsmCache.ssmCache.values = {};
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

    // Mock initial ssm params
    ssmParams = [
      {
        Name: '/test/fake/param/1',
        Value: 'value',
      },
    ];

    const loadPaginatedSpy = jest.spyOn(SsmCache, 'loadPaginated');

    // Ensure first call returns expected params
    await SsmCache.loadSsmCache(ssmCacheConfig);
    expect(loadPaginatedSpy).toHaveBeenCalledTimes(1);
    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/1');
    expect(SsmCache.ssmCache.values).not.toHaveProperty('/test/fake/param/2');

    // Mock adding param to ssm
    ssmParams = [
      {
        Name: '/test/fake/param/1',
        Value: 'value',
      },
      {
        Name: '/test/fake/param/2',
        Value: 'value',
      },
    ];

    // Ensure second call returns new param
    await SsmCache.loadSsmCache(ssmCacheConfig);
    expect(loadPaginatedSpy).toHaveBeenCalledTimes(2);

    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/1');
    expect(SsmCache.ssmCache.values).toHaveProperty('/test/fake/param/2');
  });
});
