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
  getBeaconDispatchApiVersionSsmPath,
  getBeaconLatestSeenSsmPath,
  getCompletedContactJobsQueueUrlSsmPath,
  getContactJobsQueueUrlSsmPath,
  getContactJobScrubTranscriptEnabledSsmPath,
  getEntityNotificationsTopicArnSsmPath,
  getIndexTranscriptsForSearchSsmPath,
  getPermissionConfigSsmPath,
  getTranscriptRetentionDaysSsmPath,
  getTwilioAuthTokenSsmPath,
} from '../../ssmParameterNameGetters';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

test('builds HRM-specific SSM paths', () => {
  expect(getTwilioAuthTokenSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/twilio/AC123/auth_token',
  );
  expect(getPermissionConfigSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/config/AC123/permission_config',
  );
  expect(getEntityNotificationsTopicArnSsmPath({ entityType: 'contact' })).toBe(
    '/test/us-east-1/hrm/contact/notifications-sns-topic-arn',
  );
  expect(getCompletedContactJobsQueueUrlSsmPath({})).toBe(
    '/test/us-east-1/sqs/jobs/hrm-contact/queue-url-complete',
  );
  expect(getContactJobsQueueUrlSsmPath({ jobType: 'transcript' })).toBe(
    '/test/us-east-1/sqs/jobs/hrm-contact/queue-url-transcript',
  );
  expect(getContactJobScrubTranscriptEnabledSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/us-east-1/AC123/jobs/contact/scrub-transcript/enabled',
  );
  expect(getTranscriptRetentionDaysSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/hrm/AC123/transcript_retention_days',
  );
  expect(getIndexTranscriptsForSearchSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/hrm/AC123/index_transcripts_for_search',
  );
  expect(getBeaconBaseUrlSsmPath({ helplineShortCode: 'UsCr' })).toBe(
    '/test/hrm/custom-integration/UsCr/beacon_base_url',
  );
  expect(getBeaconApiKeySsmPath({ helplineShortCode: 'uscr' })).toBe(
    '/test/hrm/custom-integration/uscr/beacon_api_key',
  );
  expect(getBeaconDispatchApiVersionSsmPath({ helplineShortCode: 'uscr' })).toBe(
    '/test/hrm/custom-integration/uscr/beacon_dispatch_api_version',
  );
  expect(
    getBeaconLatestSeenSsmPath({ accountSid: 'AC123', apiType: 'incidentReport' }),
  ).toBe('/test/hrm/custom-integration/beacon/AC123/incidentReport/latest_seen');
});
