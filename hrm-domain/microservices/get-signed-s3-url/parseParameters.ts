import { ALBEvent } from 'aws-lambda';
import { GetSignedUrlMethods } from '@tech-matters/s3-client';
import {
  newErrorResult,
  newSuccessResult,
  ErrorResult,
  SuccessResult,
} from '@tech-matters/types';

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
  recordingUrlProvider: {
    requiredParameters: ['contactId'],
  },
};

export const parseParameters = (event: ALBEvent): ParseParametersResult => {
  const { queryStringParameters } = event;

  if (!queryStringParameters) {
    return newErrorResult({ message: 'Missing queryStringParameters' });
  }

  const { method, bucket, key, accountSid, requestType } = queryStringParameters;

  if (!method || !bucket || !key || !accountSid || !requestType) {
    return newErrorResult({
      message:
        'Missing required queryStringParameters: method, bucket, key, accountSid, requestType',
    });
  }

  if (!methods.includes(method)) return newErrorResult({ message: 'Invalid method' });

  if (!Object.keys(requestTypes).includes(requestType)) {
    return newErrorResult({ message: 'Invalid requestType' });
  }

  const requestTypeConfig = requestTypes[requestType as keyof typeof requestTypes];

  const missingRequiredParameters = requestTypeConfig.requiredParameters.filter(
    requiredParameter => !queryStringParameters[requiredParameter],
  );

  if (missingRequiredParameters.length > 0) {
    return newErrorResult({
      message: `Missing required parameters: ${missingRequiredParameters.join(', ')}`,
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
