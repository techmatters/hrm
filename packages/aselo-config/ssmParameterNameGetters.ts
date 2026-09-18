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

const getDefaultRegion = () => process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

export const getHrmStaticKeySsmPath = ({
  keyName,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  keyName: string;
  environment?: string;
  region?: string;
}) => `/${environment}/hrm/service/${region}/static_key/${keyName}`;

export const getTwilioStaticKeySsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/twilio/${accountSid}/static_key`;

export const getTwilioAuthTokenSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/twilio/${accountSid}/auth_token`;

export const getTwilioAccountSidSsmPath = ({
  shortCode,
  environment = process.env.NODE_ENV,
}: {
  shortCode: string;
  environment?: string;
}) => `/${environment}/twilio/${shortCode.toUpperCase()}/account_sid`;

export const getTwilioShortHelplineSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/twilio/${accountSid}/short_helpline`;

export const getS3DocsBucketNameSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/s3/${accountSid}/docs_bucket_name`;

export const getPermissionConfigSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/config/${accountSid}/permission_config`;

export const getEntityNotificationsTopicArnSsmPath = ({
  entityType,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  entityType: string;
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/hrm/${entityType}/notifications-sns-topic-arn`;

export const getCompletedContactJobsQueueUrlSsmPath = ({
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/sqs/jobs/hrm-contact/queue-url-complete`;

export const getContactJobsQueueUrlSsmPath = ({
  jobType,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  jobType: string;
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/sqs/jobs/hrm-contact/queue-url-${jobType}`;

export const getResourcesSearchIndexQueueUrlSsmPath = ({
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/sqs/jobs/hrm-resources-search/queue-url-index`;

export const getContactJobScrubTranscriptEnabledSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  accountSid: string;
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/${accountSid}/jobs/contact/scrub-transcript/enabled`;

export const getTranscriptRetentionDaysSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/hrm/${accountSid}/transcript_retention_days`;

export const getIndexTranscriptsForSearchSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/hrm/${accountSid}/index_transcripts_for_search`;

export const getBeaconBaseUrlSsmPath = ({
  helplineShortCode,
  environment = process.env.NODE_ENV,
}: {
  helplineShortCode: string;
  environment?: string;
}) => `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_base_url`;

export const getBeaconApiKeySsmPath = ({
  helplineShortCode,
  environment = process.env.NODE_ENV,
}: {
  helplineShortCode: string;
  environment?: string;
}) => `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_api_key`;

export const getBeaconLatestSeenSsmPath = ({
  accountSid,
  apiType,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  apiType: string;
  environment?: string;
}) =>
  `/${environment}/hrm/custom-integration/beacon/${accountSid}/${apiType}/latest_seen`;

export const getResourcesImportApiBaseUrlSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/base_url`;

export const getResourcesImportApiKeySsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/api_key`;

export const getResourcesImportApiAuthHeaderSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/auth_header`;
