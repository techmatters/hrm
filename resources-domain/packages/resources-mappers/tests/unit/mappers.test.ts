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

import { FieldMappingContext, substituteCaptureTokens } from '../../mappers';

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
