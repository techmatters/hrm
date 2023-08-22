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
import {
  isErrorResult,
  ErrorResult,
  SuccessResult,
  newErrorResult,
  newSuccessResult,
} from '@tech-matters/types';
import { authenticate } from '@tech-matters/hrm-authentication';
import { getSignedUrl } from '@tech-matters/s3-client';
import { parseParameters } from './parseParameters';

export type GetSignedS3UrlSuccess = SuccessResult & {
  result: {
    media_url: string;
  };
};

export type GetSignedS3UrlResult = GetSignedS3UrlSuccess | ErrorResult;

const getSignedS3Url = async (event: ALBEvent): Promise<GetSignedS3UrlResult> => {
  const parseParametersResult = parseParameters(event);
  if (isErrorResult(parseParametersResult)) {
    return parseParametersResult;
  }

  const { accountSid, method, objectType, objectId, fileType } =
    parseParametersResult.result;

  console.log('authenticating', {
    accountSid,
    method,
    objectType,
    objectId,
    fileType,
  });

  const authenticateResult = await authenticate();
  if (isErrorResult(authenticateResult)) {
    return authenticateResult;
  }

  const { bucket, key } = parseParametersResult.result;

  try {
    const getSignedUrlResult = await getSignedUrl({
      method,
      bucket,
      key,
    });

    return newSuccessResult({
      result: {
        media_url: getSignedUrlResult,
      },
    });
  } catch (error) {
    return newErrorResult({
      message: error as string,
    });
  }
};

export default getSignedS3Url;
