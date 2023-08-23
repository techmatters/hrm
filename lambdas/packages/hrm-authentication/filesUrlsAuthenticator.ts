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
