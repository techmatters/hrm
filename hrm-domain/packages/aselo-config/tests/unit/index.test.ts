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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  getBeaconApiKey,
  getBeaconBaseUrl,
  getBeaconDispatchApiVersion,
  getBeaconLatestSeen,
  getCompletedContactJobsQueueUrl,
  getContactJobsQueueUrl,
  getContactJobScrubTranscriptEnabled,
  getEntityNotificationsTopicArn,
  getIndexTranscriptsForSearch,
  getPermissionConfig,
  getTranscriptRetentionDays,
  getTwilioAuthToken,
} from '../../index';

jest.mock('@tech-matters/ssm-cache', () => {
  const actual = jest.requireActual('@tech-matters/ssm-cache');
  return { ...actual, getSsmParameter: jest.fn() };
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

describe('HRM SSM parameter getters', () => {
  const cases: [
    string,
    (args: any) => Promise<string>,
    Record<string, unknown>,
    string,
  ][] = [
    [
      'getPermissionConfig',
      getPermissionConfig,
      { accountSid: 'AC123' },
      '/test/config/AC123/permission_config',
    ],
    [
      'getTwilioAuthToken',
      getTwilioAuthToken,
      { accountSid: 'AC123' },
      '/test/twilio/AC123/auth_token',
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
      'getBeaconDispatchApiVersion',
      getBeaconDispatchApiVersion,
      { helplineShortCode: 'uscr' },
      '/test/hrm/custom-integration/uscr/beacon_dispatch_api_version',
    ],
    [
      'getBeaconLatestSeen',
      getBeaconLatestSeen,
      { accountSid: 'AC123', apiType: 'incidentReport' },
      '/test/hrm/custom-integration/beacon/AC123/incidentReport/latest_seen',
    ],
  ];

  test.each(cases)('%s looks up the expected path', async (_name, getter, args, path) => {
    await expect(getter(args)).resolves.toBe('the-value');
    expect(mockGetSsmParameter).toHaveBeenCalledWith(path, undefined);
  });
});
