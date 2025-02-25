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

import { newOk, isErr } from '@tech-matters/types';
import {
  HrmAuthenticateParameters,
  HrmAuthenticateResult,
  HRMAuthenticationObjectTypes,
} from './index';
import callHrmApi from './callHrmApi';

export const mockBuckets = ['mock-bucket'];

export const fileTypes = {
  recording: 'Recording',
  transcript: 'ExternalTranscript',
  document: 'Case',
} as const;

export type FileTypes = keyof typeof fileTypes;

export type FileMethods = 'getObject' | 'putObject' | 'deleteObject';

export const fileMethods: Record<
  HRMAuthenticationObjectTypes,
  Partial<Record<FileMethods, string>>
> = {
  contact: {
    getObject: 'view',
  },
  // There are no read/write permissions for case files yet.
  // We are using view case permissions to emulate the current
  // permissions for case files.
  case: {
    getObject: 'view',
    putObject: 'view',
    deleteObject: 'view',
  },
} as const;

export const getPermission = ({
  objectType,
  fileType,
  method,
}: {
  objectType: HRMAuthenticationObjectTypes;
  fileType: FileTypes;
  method: FileMethods;
}) => {
  if (!fileTypes[fileType]) throw new Error('Invalid fileType');
  if (!fileMethods[objectType]?.[method]) throw new Error('Invalid method');

  // We needed a way to bridge the gap between the files urls requests
  // and the hrm permission system until we can refactor the hrm side.
  // This is a temporary solution that should be removed in the future
  // when we refactor the hrm side of permissions to be more fine grained.
  return `${fileMethods[objectType][method]}${fileTypes[fileType]}`;
};

export type HrmAuthenticateFilesUrlsRequestData = {
  method: FileMethods;
  bucket: string;
  key: string;
  fileType: FileTypes;
};

export const authUrlPathGenerator = ({
  accountSid,
  objectType,
  requestData: { fileType, method },
}: HrmAuthenticateParameters) => {
  const permission = getPermission({ objectType, fileType, method });

  return `v0/accounts/${accountSid}/permissions/${permission}`;
};

const filesUrlsAuthenticator = async (
  params: HrmAuthenticateParameters,
): Promise<HrmAuthenticateResult> => {
  const {
    objectId,
    objectType,
    authHeader,
    requestData: { bucket, key },
  } = params;

  // This is a quick and dirty way to lock this down so we can test
  // with fake data without exposing real data in the test environment.
  if (mockBuckets.includes(bucket)) {
    return newOk({ data: true });
  }

  const result = await callHrmApi({
    urlPath: authUrlPathGenerator(params),
    authHeader,
    method: 'GET',
    requestData: {
      objectType,
      objectId,
      bucket,
      key,
    },
  });
  if (isErr(result)) {
    return result;
  }

  return newOk({ data: true });
};

export default filesUrlsAuthenticator;
