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

import { AlbHandlerEvent } from '@tech-matters/alb-handler';
import { GetSignedUrlMethods, GET_SIGNED_URL_METHODS } from '@tech-matters/s3-client';
import { Result as R, FileTypes } from '@tech-matters/types';

const objectTypes = {
  contact: {
    requiredParameters: ['objectId'],
    fileTypes: ['recording', 'transcript'],
  },
};

export const ERROR_MESSAGES = {
  MISSING_QUERY_STRING_PARAMETERS: 'Missing queryStringParameters',
  MISSING_REQUIRED_QUERY_STRING_PARAMETERS:
    'Missing required queryStringParameters: method, bucket, key, accountSid, fileType',
  INVALID_METHOD: 'Invalid method',
  INVALID_OBJECT_TYPE: 'Invalid objectType',
  INVALID_FILE_TYPE: 'Invalid fileType',
  MISSING_REQUIRED_PARAMETERS_FOR_FILE_TYPE: 'Missing required parameters for fileType',
};

export type Parameters = {
  method: GetSignedUrlMethods;
  bucket: string;
  key: string;
  accountSid: string;
  fileType: FileTypes;
  objectType: string;
  objectId?: string;
};

export type ParseParametersResult = R.TResult<Parameters>;

export type ParsePathParametersResult = {
  accountSid?: string;
};

const isSignedUrlMethod = (method: string): method is GetSignedUrlMethods =>
  Object.keys(GET_SIGNED_URL_METHODS).includes(method);

const parsePathParameters = (path: string): ParsePathParametersResult => {
  const accountSidAndObjectMatch = /\/accounts\/([^\/]+)/.exec(path);

  return {
    accountSid: accountSidAndObjectMatch ? accountSidAndObjectMatch[1] : undefined,
  };
};

export const parseParameters = (event: AlbHandlerEvent): ParseParametersResult => {
  const { path, queryStringParameters } = event;
  if (!queryStringParameters) {
    return R.err({ message: ERROR_MESSAGES.MISSING_QUERY_STRING_PARAMETERS });
  }

  const { method, bucket, key, objectType, objectId, fileType } = queryStringParameters;
  const { accountSid } = parsePathParameters(path);
  if (!method || !bucket || !key || !accountSid || !objectType || !fileType) {
    return R.err({
      message: ERROR_MESSAGES.MISSING_REQUIRED_QUERY_STRING_PARAMETERS,
    });
  }

  if (!isSignedUrlMethod(method)) {
    return R.err({ message: ERROR_MESSAGES.INVALID_METHOD });
  }

  const objectTypeConfig = objectTypes[objectType as keyof typeof objectTypes];

  if (!objectTypeConfig) {
    return R.err({ message: ERROR_MESSAGES.INVALID_OBJECT_TYPE });
  }

  if (!objectTypeConfig.fileTypes.includes(fileType as FileTypes)) {
    return R.err({ message: ERROR_MESSAGES.INVALID_FILE_TYPE });
  }

  const missingRequiredParameters = objectTypeConfig.requiredParameters.filter(
    requiredParameter => !queryStringParameters[requiredParameter],
  );

  if (missingRequiredParameters.length > 0) {
    return R.err({
      message: ERROR_MESSAGES.MISSING_REQUIRED_PARAMETERS_FOR_FILE_TYPE,
    });
  }

  return R.ok({
    data: {
      method,
      bucket,
      key,
      accountSid,
      fileType: fileType as FileTypes,
      objectType,
      objectId,
    },
  });
};
