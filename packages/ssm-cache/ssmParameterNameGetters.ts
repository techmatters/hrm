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

import { getSsmParameter, SsmParameterNotFound } from './ssmCache';

const getDefaultRegion = () => process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

export const getHrmStaticKeySsmPath = (
  keyName: string,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/hrm/service/${region}/static_key/${keyName}`;

export const getTwilioStaticKeySsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/twilio/${accountSid}/static_key`;

export const getTwilioAuthTokenSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/twilio/${accountSid}/auth_token`;

export const getTwilioAccountSidSsmPath = (
  shortCode: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/twilio/${shortCode.toUpperCase()}/account_sid`;

export const getTwilioShortHelplineSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/twilio/${accountSid}/short_helpline`;

export const getS3DocsBucketNameSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/s3/${accountSid}/docs_bucket_name`;

export const getPermissionConfigSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/config/${accountSid}/permission_config`;

export const getEntityNotificationsTopicArnSsmPath = (
  entityType: string,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/${region}/hrm/${entityType}/notifications-sns-topic-arn`;

export const getCompletedContactJobsQueueUrlSsmPath = (
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/${region}/sqs/jobs/hrm-contact/queue-url-complete`;

export const getContactJobsQueueUrlSsmPath = (
  jobType: string,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/${region}/sqs/jobs/hrm-contact/queue-url-${jobType}`;

export const getResourcesSearchIndexQueueUrlSsmPath = (
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/${region}/sqs/jobs/hrm-resources-search/queue-url-index`;

export const getContactJobScrubTranscriptEnabledSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
) => `/${environment}/${region}/${accountSid}/jobs/contact/scrub-transcript/enabled`;

export const getTranscriptRetentionDaysSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/hrm/${accountSid}/transcript_retention_days`;

export const getIndexTranscriptsForSearchSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/hrm/${accountSid}/index_transcripts_for_search`;

export const getBeaconBaseUrlSsmPath = (
  helplineShortCode: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_base_url`;

export const getBeaconApiKeySsmPath = (
  helplineShortCode: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_api_key`;

export const getBeaconLatestSeenSsmPath = (
  accountSid: string,
  apiType: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/hrm/custom-integration/beacon/${accountSid}/${apiType}/latest_seen`;

export const getResourcesImportApiBaseUrlSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/resources/${accountSid}/import_api/base_url`;

export const getResourcesImportApiKeySsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/resources/${accountSid}/import_api/api_key`;

export const getResourcesImportApiAuthHeaderSsmPath = (
  accountSid: string,
  environment = process.env.NODE_ENV,
) => `/${environment}/resources/${accountSid}/import_api/auth_header`;

export const getAccountStaticKey = async (keyName: string) => {
  try {
    return await getSsmParameter(getHrmStaticKeySsmPath(keyName));
  } catch (error) {
    // Remove when a terraform apply has been done for all accounts
    if (error instanceof SsmParameterNotFound && keyName.startsWith('AC')) {
      console.warn(
        `New internal API key not set up for ${keyName} yet, looking for legacy key`,
      );

      return getSsmParameter(getTwilioStaticKeySsmPath(keyName));
    }

    throw error;
  }
};
