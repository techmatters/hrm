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

import { ALBEvent } from 'aws-lambda';
import { GetSignedUrlMethods } from '@tech-matters/s3-client';
import {
  newErrorResult,
  newSuccessResult,
  ErrorResult,
  SuccessResult,
} from '@tech-matters/types';

export const ERROR_MESSAGES = {
  MISSING_QUERY_STRING_PARAMETERS: 'Missing queryStringParameters',
  MISSING_REQUIRED_QUERY_STRING_PARAMETERS:
    'Missing required queryStringParameters: method, bucket, key, accountSid, requestType',
  INVALID_METHOD: 'Invalid method',
  INVALID_REQUEST_TYPE: 'Invalid requestType',
  MISSING_REQUIRED_PARAMETERS_FOR_REQUEST_TYPE:
    'Missing required parameters for requestType',
};

export type Parameters = {
  method: GetSignedUrlMethods;
  bucket: string;
  key: string;
  accountSid: string;
  requestType: string;
  contactId?: string;
};

export type ParseParametersSuccess = SuccessResult & {
  result: Parameters;
};

export type ParseParametersResult = ErrorResult | ParseParametersSuccess;

const methods = ['getObject', 'putObject', 'deleteObject'];

const requestTypes = {
  contactRecording: {
    requiredParameters: ['contactId'],
  },
};

export const parseParameters = (event: ALBEvent): ParseParametersResult => {
  const { queryStringParameters } = event;

  if (!queryStringParameters) {
    return newErrorResult({ message: ERROR_MESSAGES.MISSING_QUERY_STRING_PARAMETERS });
  }

  const { method, bucket, key, accountSid, requestType } = queryStringParameters;

  if (!method || !bucket || !key || !accountSid || !requestType) {
    return newErrorResult({
      message: ERROR_MESSAGES.MISSING_REQUIRED_QUERY_STRING_PARAMETERS,
    });
  }

  if (!methods.includes(method))
    return newErrorResult({ message: ERROR_MESSAGES.INVALID_METHOD });

  if (!Object.keys(requestTypes).includes(requestType)) {
    return newErrorResult({ message: ERROR_MESSAGES.INVALID_REQUEST_TYPE });
  }

  const requestTypeConfig = requestTypes[requestType as keyof typeof requestTypes];

  const missingRequiredParameters = requestTypeConfig.requiredParameters.filter(
    requiredParameter => !queryStringParameters[requiredParameter],
  );

  if (missingRequiredParameters.length > 0) {
    return newErrorResult({
      message: ERROR_MESSAGES.MISSING_REQUIRED_PARAMETERS_FOR_REQUEST_TYPE,
    });
  }

  return newSuccessResult({
    result: {
      method,
      bucket,
      key,
      accountSid,
      requestType,
      contactId: queryStringParameters.contactId,
    },
  });
};
