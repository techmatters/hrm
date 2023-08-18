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

  const authenticateResult = await authenticate();
  if (isErrorResult(authenticateResult)) {
    return authenticateResult;
  }

  const { method, bucket, key } = parseParametersResult.result;

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
