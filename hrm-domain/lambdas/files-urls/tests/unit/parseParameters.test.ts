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
import type { ALBEvent } from 'aws-lambda';
import { newErrorResult, newSuccessResult } from '@tech-matters/types';
import { parseParameters, ERROR_MESSAGES } from '../../parseParameters';
import {
  mockPathParameters,
  mockQueryStringParameters,
  newAlbEvent,
  mockPath,
} from '../__mocks__';

describe('parseParameters', () => {
  it('should return a 500 error for missing query string options', async () => {
    const event = {
      queryStringParameters: {},
    } as ALBEvent;
    const result = await parseParameters(event);
    expect(result).toEqual(
      newErrorResult({
        message: ERROR_MESSAGES.MISSING_REQUIRED_QUERY_STRING_PARAMETERS,
      }),
    );
  });

  it('should return a 500 error for invalid method', async () => {
    const event = newAlbEvent({
      queryStringParameters: {
        ...mockQueryStringParameters,
        method: 'invalidMethod',
      },
    });
    const result = await parseParameters(event);
    expect(result).toEqual(
      newErrorResult({
        message: ERROR_MESSAGES.INVALID_METHOD,
      }),
    );
  });

  it('should return a 500 error for invalid requestType', async () => {
    const event = newAlbEvent({
      path: mockPath({ requestType: 'invalidRequestType' }),
    });
    const result = await parseParameters(event);
    expect(result).toEqual(
      newErrorResult({
        message: ERROR_MESSAGES.INVALID_REQUEST_TYPE,
      }),
    );
  });

  it('should return a 500 error for missing required parameters for requestType', async () => {
    const event = newAlbEvent({
      queryStringParameters: {
        ...mockQueryStringParameters,
        contactId: undefined,
        requestType: 'contactRecording',
      },
    });
    const result = await parseParameters(event);
    expect(result).toEqual(
      newErrorResult({
        message: ERROR_MESSAGES.MISSING_REQUIRED_PARAMETERS_FOR_REQUEST_TYPE,
      }),
    );
  });

  it('should return a 200 success for valid parameters', async () => {
    const event = newAlbEvent({
      queryStringParameters: mockQueryStringParameters,
    });
    const result = await parseParameters(event);
    expect(result).toEqual(
      newSuccessResult({
        result: {
          ...mockQueryStringParameters,
          ...mockPathParameters,
        },
      }),
    );
  });
});
