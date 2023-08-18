import type { ALBEvent } from 'aws-lambda';

export const mockQueryStringParameters = {
  method: 'getObject',
  bucket: 'contact-docs-bucket',
  key: 'test-key',
  accountSid: 'test-account-sid',
  requestType: 'contactRecording',
  contactId: 'test-contact-id',
};

export const albEventBase = {
  httpMethod: 'GET',
  requestContext: {
    elb: {
      targetGroupArn:
        'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/lambda-123456789012/1234567890123456',
    },
  },
  body: '',
  isBase64Encoded: false,
  path: '/lambdas/getSignedS3Url',
  queryStringParameters: mockQueryStringParameters,
};

export const newAlbEvent = (partial: any): ALBEvent => {
  return { ...albEventBase, ...partial };
};

export const mockSignedUrl = 'https://example.com/signed-url';
