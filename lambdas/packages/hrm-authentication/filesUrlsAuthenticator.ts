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

import {
  FileTypes,
  FileMethods,
  fileTypes,
  fileMethods,
  isErrorResult,
  newSuccessResult,
} from '@tech-matters/types';
import { HrmAuthenticateParameters, HrmAuthenticateResult } from './index';
import callHrmApi from './callHrmApi';

export const mockBuckets = ['mock-bucket'];

export const getPermission = ({
  fileType,
  method,
}: {
  fileType: FileTypes;
  method: FileMethods;
}) => {
  return `${fileMethods[method]}${fileTypes[fileType]}`;
};

export type HrmAuthenticateFilesUrlsRequestData = {
  method: FileMethods;
  bucket: string;
  key: string;
  fileType: FileTypes;
};

export const authUrlPathGenerator = ({
  accountSid,
  objectId,
  objectType,
  requestData: { bucket, key, fileType, method },
}: HrmAuthenticateParameters) => {
  const permission = getPermission({ fileType, method });

  if (!objectId) throw new Error('objectId is required');
  const params = new URLSearchParams({
    objectType,
    objectId,
    bucket,
    key,
    permission,
  }).toString();

  return `v0/accounts/${accountSid}/permissions/${permission}?${params}`;
};

const filesUrlsAuthenticator = async (
  params: HrmAuthenticateParameters,
): Promise<HrmAuthenticateResult> => {
  const { authHeader, requestData } = params;

  // This is a quick and dirty way to lock this down so we can test with fake data without exposing real data in the test environment
  if (mockBuckets.includes(requestData.bucket)) {
    return newSuccessResult({ data: true });
  }

  const result = await callHrmApi({
    urlPath: authUrlPathGenerator(params),
    authHeader,
  });
  if (isErrorResult(result)) {
    return result;
  }

  return newSuccessResult({ data: true });
};

export default filesUrlsAuthenticator;
