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

import { isErrorResult, newSuccessResult } from '@tech-matters/types';
import { HrmAuthenticateParameters, HrmAuthenticateResult } from './index';
import callHrmApi from './callHrmApi';

export const mockBuckets = ['mockBucket', 'contact-docs-bucket'];

export const authUrlPathGenerator = ({
  accountSid,
  objectType,
  objectId,
}: HrmAuthenticateParameters) => {
  return `v0/accounts/${accountSid}/${objectType}/${objectId}/auth/filesUrls`;
};

const filesUrlsAuthenticator = async (
  params: HrmAuthenticateParameters,
): Promise<HrmAuthenticateResult> => {
  const { authHeader, requestData } = params;

  // This is a quick and dirty way to lock this down so we can test with fake data without exposing real data in the test environment
  if (mockBuckets.includes(requestData.bucket)) {
    return newSuccessResult({ result: true });
  }

  const result = await callHrmApi({
    urlPath: authUrlPathGenerator(params),
    authHeader,
    requestData,
  });
  if (isErrorResult(result)) {
    return result;
  }

  return newSuccessResult({ result: true });
};

export default filesUrlsAuthenticator;
