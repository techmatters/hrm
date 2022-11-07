import { addToCache, getSsmParameter, ssmCache, SsmParameterNotFound } from '../../index';

describe('addToCache', () => {
  it('should add a value to the cache with matching regex', () => {
    const ssmParam = {
      Name: '/localstack/test/param',
      Value: 'value',
    };

    addToCache(/param/, ssmParam);

    expect(ssmCache.values).toHaveProperty(ssmParam.Name);
    expect(ssmCache.values[ssmParam.Name]).toEqual(ssmParam.Value);
    expect(getSsmParameter(ssmParam.Name)).toEqual(ssmParam.Value);
  });

  it('should not add a value to the cache with non-matching regex', () => {
    const ssmParam = {
      Name: '/localstack/test/badRegex',
      Value: 'value',
    };

    addToCache(/notRight/, ssmParam);

    expect(ssmCache.values).not.toHaveProperty(ssmParam.Name);
    expect(() => getSsmParameter(ssmParam.Name)).toThrow(SsmParameterNotFound);
  });
});
