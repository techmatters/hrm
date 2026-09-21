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

import {
  getBeaconApiKeySsmPath,
  getBeaconBaseUrlSsmPath,
  getBeaconLatestSeenSsmPath,
  getCompletedContactJobsQueueUrlSsmPath,
  getContactJobsQueueUrlSsmPath,
  getContactJobScrubTranscriptEnabledSsmPath,
  getEntityNotificationsTopicArnSsmPath,
  getHrmStaticKeySsmPath,
  getIndexTranscriptsForSearchSsmPath,
  getPermissionConfigSsmPath,
  getResourcesImportApiAuthHeaderSsmPath,
  getResourcesImportApiBaseUrlSsmPath,
  getResourcesImportApiKeySsmPath,
  getResourcesSearchIndexQueueUrlSsmPath,
  getS3DocsBucketNameSsmPath,
  getTranscriptRetentionDaysSsmPath,
  getTwilioAccountSidSsmPath,
  getTwilioAuthTokenSsmPath,
  getTwilioShortHelplineSsmPath,
  getTwilioStaticKeySsmPath,
} from '../../ssmParameterNameGetters';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

describe('ssm parameter path getters', () => {
  test('builds account sid paths from uppercase short codes', () => {
    expect(getTwilioAccountSidSsmPath({ shortCode: 'as' })).toBe(
      '/test/twilio/AS/account_sid',
    );
  });

  test('builds HRM service static key paths using environment and region', () => {
    expect(getHrmStaticKeySsmPath({ keyName: 'ADMIN_HRM' })).toBe(
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
    );
  });

  test('preserves beacon helpline code casing supplied by the caller', () => {
    expect(getBeaconBaseUrlSsmPath({ helplineShortCode: 'USCR' })).toBe(
      '/test/hrm/custom-integration/USCR/beacon_base_url',
    );
    expect(getBeaconApiKeySsmPath({ helplineShortCode: 'UsCr' })).toBe(
      '/test/hrm/custom-integration/UsCr/beacon_api_key',
    );
  });

  test('builds twilio auth token paths using account sid', () => {
    expect(getTwilioAuthTokenSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/twilio/AC123/auth_token',
    );
  });

  test('builds twilio static key paths using account sid', () => {
    expect(getTwilioStaticKeySsmPath({ accountSid: 'AC123' })).toBe(
      '/test/twilio/AC123/static_key',
    );
  });

  test('builds twilio short helpline paths using account sid', () => {
    expect(getTwilioShortHelplineSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/twilio/AC123/short_helpline',
    );
  });

  test('builds docs bucket paths using account sid', () => {
    expect(getS3DocsBucketNameSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/s3/AC123/docs_bucket_name',
    );
  });

  test('builds permission config paths using account sid', () => {
    expect(getPermissionConfigSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/config/AC123/permission_config',
    );
  });

  test('builds entity notifications topic paths using environment and region', () => {
    expect(getEntityNotificationsTopicArnSsmPath({ entityType: 'contact' })).toBe(
      '/test/us-east-1/hrm/contact/notifications-sns-topic-arn',
    );
  });

  test('builds completed contact jobs queue paths using environment and region', () => {
    expect(getCompletedContactJobsQueueUrlSsmPath({})).toBe(
      '/test/us-east-1/sqs/jobs/hrm-contact/queue-url-complete',
    );
  });

  test('builds contact jobs queue paths using job type', () => {
    expect(
      getContactJobsQueueUrlSsmPath({ jobType: 'retrieve-contact-transcript' }),
    ).toBe('/test/us-east-1/sqs/jobs/hrm-contact/queue-url-retrieve-contact-transcript');
  });

  test('builds resources search index queue paths using environment and region', () => {
    expect(getResourcesSearchIndexQueueUrlSsmPath({})).toBe(
      '/test/us-east-1/sqs/jobs/hrm-resources-search/queue-url-index',
    );
  });

  test('builds scrub transcript flag paths using account sid, environment, and region', () => {
    expect(getContactJobScrubTranscriptEnabledSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/us-east-1/AC123/jobs/contact/scrub-transcript/enabled',
    );
  });

  test('builds transcript retention paths using account sid', () => {
    expect(getTranscriptRetentionDaysSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/hrm/AC123/transcript_retention_days',
    );
  });

  test('builds transcript indexing flag paths using account sid', () => {
    expect(getIndexTranscriptsForSearchSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/hrm/AC123/index_transcripts_for_search',
    );
  });

  test('builds beacon latest seen paths using account sid and api type', () => {
    expect(
      getBeaconLatestSeenSsmPath({ accountSid: 'AC123', apiType: 'incidentReport' }),
    ).toBe('/test/hrm/custom-integration/beacon/AC123/incidentReport/latest_seen');
  });

  test('builds resources import api base url paths using account sid', () => {
    expect(getResourcesImportApiBaseUrlSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/resources/AC123/import_api/base_url',
    );
  });

  test('builds resources import api key paths using account sid', () => {
    expect(getResourcesImportApiKeySsmPath({ accountSid: 'AC123' })).toBe(
      '/test/resources/AC123/import_api/api_key',
    );
  });

  test('builds resources import api auth header paths using account sid', () => {
    expect(getResourcesImportApiAuthHeaderSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/resources/AC123/import_api/auth_header',
    );
  });
});
