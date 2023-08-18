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
import { mocked } from 'jest-mock';
import { newSuccessResult } from '@tech-matters/types';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import getSignedS3Url from '../../getSignedS3Url';
import { mockQueryStringParameters, mockSignedUrl, newAlbEvent } from '../__mocks__';

jest.mock('@aws-sdk/s3-request-presigner');

const mockedGetSignedUrl = mocked(awsGetSignedUrl);

describe('getSignedS3Url', () => {
  beforeEach(() => {
    mockedGetSignedUrl.mockClear();
  });

  it('should return media url for getObject method', async () => {
    mockedGetSignedUrl.mockResolvedValue(mockSignedUrl);

    const event = newAlbEvent({
      queryStringParameters: mockQueryStringParameters,
    });

    const result = await getSignedS3Url(event);
    expect(result).toEqual(newSuccessResult({ result: { media_url: mockSignedUrl } }));
  });
});
