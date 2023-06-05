import { FieldMappingContext, substituteCaptureTokens } from '../../src/mappers';

const baselineContext: FieldMappingContext = {
  captures: {},
  path: [],
  rootResource: {},
};

describe('substituteCaptureTokens', () => {
  test('should substitute single capture tokens, ignoring irrelevant ones', () => {
    expect(
      substituteCaptureTokens('operations/{operationSetIndex}/siteId', {
        ...baselineContext,
        captures: { operationSetIndex: '1', dayIndex: '2', language: 'fr' },
      }),
    ).toEqual('operations/1/siteId');
  });
  test('should substitute several capture tokens', () => {
    expect(
      substituteCaptureTokens('operations/{operationSetIndex}/{dayIndex}', {
        ...baselineContext,
        captures: { operationSetIndex: '1', dayIndex: '2', language: 'fr' },
      }),
    ).toEqual('operations/1/2');
  });
  test('should be a noop if the are no capture tokens', () => {
    expect(
      substituteCaptureTokens('operations/additionalInfo', {
        ...baselineContext,
        captures: { operationSetIndex: '1', dayIndex: '2', language: 'fr' },
      }),
    ).toEqual('operations/additionalInfo');
  });
  test('should ignore empty captures', () => {
    expect(
      substituteCaptureTokens('operations/{}/siteId', {
        ...baselineContext,
        captures: { operationSetIndex: '1', dayIndex: '2', language: 'fr' },
      }),
    ).toEqual('operations/{}/siteId');
  });
  test('should ignore unmatched braces', () => {
    expect(
      substituteCaptureTokens('operations/{operationSetIndex}/}{', {
        ...baselineContext,
        captures: { operationSetIndex: '1', dayIndex: '2', language: 'fr' },
      }),
    ).toEqual('operations/1/}{');
  });
});
