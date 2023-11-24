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
import { TResult, newErr, isErr, newOk } from '@tech-matters/types';
import { authenticate } from '@tech-matters/hrm-authentication';
import { getSignedUrl } from '@tech-matters/s3-client';
import { parseParameters } from './parseParameters';

export type GetSignedS3UrlSuccessResultData = {
  media_url: string;
};

export type GetSignedS3UrlResult = TResult<GetSignedS3UrlSuccessResultData>;

/**
 * Twilio insights sends a basic auth header with the username as the string token and the password as the flexJWE.
 * This function converts that to a bearer token for use with the hrm-authentication package.
 *
 * example from https://www.twilio.com/docs/flex/developer/insights/playback-recordings-custom-storage#validate-the-flex-jwe-token:
 * Basic ${Buffer.from(`token:${flexJWE}`).toString('base64')}
 **/
export const convertBasicAuthHeader = (authHeader: string): string => {
  if (!authHeader) return authHeader;

  const [type, token] = authHeader.split(' ');
  if (type == 'Bearer') return authHeader;

  const [username, password] = Buffer.from(token, 'base64').toString().split(':');
  if (username == 'token') return `Bearer ${password}`;

  return authHeader;
};

const getSignedS3Url = async (event: AlbHandlerEvent): Promise<GetSignedS3UrlResult> => {
  const parseParametersResult = parseParameters(event);
  if (isErr(parseParametersResult)) {
    return parseParametersResult;
  }

  const {
    accountSid,
    bucket,
    key: encodedKey,
    method,
    objectType,
    objectId,
    fileType,
  } = parseParametersResult.data;

  const key = decodeURIComponent(encodedKey);

  console.log('>>>>> parseParametersResult.data', parseParametersResult.data);
  console.log('>>>>> params', {
    accountSid,
    bucket,
    key,
    method,
    objectType,
    objectId,
    fileType,
  });
  console.log('>>>>> key', key);

  const authorization = event.headers?.Authorization || event.headers?.authorization;

  const authenticateResult = await authenticate({
    accountSid,
    objectType,
    objectId,
    authHeader: convertBasicAuthHeader(authorization!),
    type: 'filesUrls',
    requestData: {
      fileType,
      method,
      bucket,
      key,
    },
  });
  if (isErr(authenticateResult)) {
    return authenticateResult;
  }

  try {
    const getSignedUrlResult = await getSignedUrl({
      method,
      bucket,
      key,
    });

    return newOk({
      data: {
        media_url: getSignedUrlResult,
      },
    });
  } catch (error) {
    return newErr({
      message: error as string,
    });
  }
};

export default getSignedS3Url;
