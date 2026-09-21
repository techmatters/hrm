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

import { SsmParameterNotFound, getSsmParameter } from '@tech-matters/ssm-cache';
import {
  getAccountStaticKey,
  getBeaconApiKey,
  getBeaconBaseUrl,
  getBeaconLatestSeen,
  getCompletedContactJobsQueueUrl,
  getContactJobsQueueUrl,
  getContactJobScrubTranscriptEnabled,
  getEntityNotificationsTopicArn,
  getHrmStaticKey,
  getIndexTranscriptsForSearch,
  getPermissionConfig,
  getResourcesImportApiAuthHeader,
  getResourcesImportApiBaseUrl,
  getResourcesImportApiKey,
  getResourcesSearchIndexQueueUrl,
  getS3DocsBucketName,
  getTranscriptRetentionDays,
  getTwilioAccountSid,
  getTwilioAuthToken,
  getTwilioShortHelpline,
  getTwilioStaticKey,
} from '../../index';

jest.mock('@tech-matters/ssm-cache', () => {
  const actual = jest.requireActual('@tech-matters/ssm-cache');
  return {
    ...actual,
    getSsmParameter: jest.fn(),
  };
});

const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
>;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  mockGetSsmParameter.mockReset();
  mockGetSsmParameter.mockResolvedValue('the-value');
});

describe('ssm parameter getters', () => {
  const getterCases: [
    string,
    (args: any) => Promise<string>,
    Record<string, unknown>,
    string,
  ][] = [
    [
      'getHrmStaticKey',
      getHrmStaticKey,
      { keyName: 'ADMIN_HRM' },
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
    ],
    [
      'getTwilioStaticKey',
      getTwilioStaticKey,
      { accountSid: 'AC123' },
      '/test/twilio/AC123/static_key',
    ],
    [
      'getTwilioAuthToken',
      getTwilioAuthToken,
      { accountSid: 'AC123' },
      '/test/twilio/AC123/auth_token',
    ],
    [
      'getTwilioAccountSid',
      getTwilioAccountSid,
      { shortCode: 'as' },
      '/test/twilio/AS/account_sid',
    ],
    [
      'getTwilioShortHelpline',
      getTwilioShortHelpline,
      { accountSid: 'AC123' },
      '/test/twilio/AC123/short_helpline',
    ],
    [
      'getS3DocsBucketName',
      getS3DocsBucketName,
      { accountSid: 'AC123' },
      '/test/s3/AC123/docs_bucket_name',
    ],
    [
      'getPermissionConfig',
      getPermissionConfig,
      { accountSid: 'AC123' },
      '/test/config/AC123/permission_config',
    ],
    [
      'getEntityNotificationsTopicArn',
      getEntityNotificationsTopicArn,
      { entityType: 'contact' },
      '/test/us-east-1/hrm/contact/notifications-sns-topic-arn',
    ],
    [
      'getCompletedContactJobsQueueUrl',
      getCompletedContactJobsQueueUrl,
      {},
      '/test/us-east-1/sqs/jobs/hrm-contact/queue-url-complete',
    ],
    [
      'getContactJobsQueueUrl',
      getContactJobsQueueUrl,
      { jobType: 'retrieve-contact-transcript' },
      '/test/us-east-1/sqs/jobs/hrm-contact/queue-url-retrieve-contact-transcript',
    ],
    [
      'getResourcesSearchIndexQueueUrl',
      getResourcesSearchIndexQueueUrl,
      {},
      '/test/us-east-1/sqs/jobs/hrm-resources-search/queue-url-index',
    ],
    [
      'getContactJobScrubTranscriptEnabled',
      getContactJobScrubTranscriptEnabled,
      { accountSid: 'AC123' },
      '/test/us-east-1/AC123/jobs/contact/scrub-transcript/enabled',
    ],
    [
      'getTranscriptRetentionDays',
      getTranscriptRetentionDays,
      { accountSid: 'AC123' },
      '/test/hrm/AC123/transcript_retention_days',
    ],
    [
      'getIndexTranscriptsForSearch',
      getIndexTranscriptsForSearch,
      { accountSid: 'AC123' },
      '/test/hrm/AC123/index_transcripts_for_search',
    ],
    [
      'getBeaconBaseUrl',
      getBeaconBaseUrl,
      { helplineShortCode: 'uscr' },
      '/test/hrm/custom-integration/uscr/beacon_base_url',
    ],
    [
      'getBeaconApiKey',
      getBeaconApiKey,
      { helplineShortCode: 'uscr' },
      '/test/hrm/custom-integration/uscr/beacon_api_key',
    ],
    [
      'getResourcesImportApiBaseUrl',
      getResourcesImportApiBaseUrl,
      { accountSid: 'AC123' },
      '/test/resources/AC123/import_api/base_url',
    ],
    [
      'getResourcesImportApiKey',
      getResourcesImportApiKey,
      { accountSid: 'AC123' },
      '/test/resources/AC123/import_api/api_key',
    ],
    [
      'getResourcesImportApiAuthHeader',
      getResourcesImportApiAuthHeader,
      { accountSid: 'AC123' },
      '/test/resources/AC123/import_api/auth_header',
    ],
    [
      'getBeaconLatestSeen',
      getBeaconLatestSeen,
      { accountSid: 'AC123', apiType: 'incidentReport' },
      '/test/hrm/custom-integration/beacon/AC123/incidentReport/latest_seen',
    ],
  ];

  test.each(getterCases)(
    '%s looks up the derived SSM path',
    async (_name, getter, args, expectedPath) => {
      const result = await getter(args);

      expect(result).toBe('the-value');
      expect(mockGetSsmParameter).toHaveBeenCalledWith(expectedPath, undefined);
    },
  );

  test('passes cache-duration options through to getSsmParameter', async () => {
    await getResourcesSearchIndexQueueUrl({
      cacheDurationMilliseconds: 86400000,
    });

    expect(mockGetSsmParameter).toHaveBeenCalledWith(
      '/test/us-east-1/sqs/jobs/hrm-resources-search/queue-url-index',
      86400000,
    );
  });
});

describe('getAccountStaticKey', () => {
  test('resolves the hrm-service-scoped static key directly when it exists', async () => {
    mockGetSsmParameter.mockResolvedValueOnce('the-key');

    const result = await getAccountStaticKey('ADMIN_HRM');

    expect(result).toBe('the-key');
    expect(mockGetSsmParameter).toHaveBeenCalledWith(
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
      undefined,
    );
  });

  test('falls back to the legacy per-account key path when an account-shaped key is missing', async () => {
    const keyName = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    mockGetSsmParameter
      .mockRejectedValueOnce(
        new SsmParameterNotFound('/test/hrm/service/us-east-1/static_key/ACxxx'),
      )
      .mockResolvedValueOnce('legacy-key');

    const result = await getAccountStaticKey(keyName);

    expect(result).toBe('legacy-key');
    expect(mockGetSsmParameter).toHaveBeenNthCalledWith(
      1,
      '/test/hrm/service/us-east-1/static_key/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      undefined,
    );
    expect(mockGetSsmParameter).toHaveBeenNthCalledWith(
      2,
      '/test/twilio/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/static_key',
      undefined,
    );
  });

  test('throws when a missing non-account key has no legacy fallback', async () => {
    mockGetSsmParameter.mockRejectedValueOnce(
      new SsmParameterNotFound('/test/hrm/service/us-east-1/static_key/ADMIN_HRM'),
    );

    await expect(getAccountStaticKey('ADMIN_HRM')).rejects.toThrow(SsmParameterNotFound);
    expect(mockGetSsmParameter).toHaveBeenCalledTimes(1);
  });

  test('rethrows unexpected lookup errors unchanged', async () => {
    const error = new Error('boom');
    mockGetSsmParameter.mockRejectedValueOnce(error);

    await expect(getAccountStaticKey('ADMIN_HRM')).rejects.toBe(error);
  });
});
