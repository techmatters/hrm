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

export * from './ssmParameterNameGetters';

import { getSsmParameter, SsmParameterNotFound } from '@tech-matters/ssm-cache';
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
} from './ssmParameterNameGetters';

type GetSsmParameterOptions = {
  cacheDurationMilliseconds?: number;
};

const createSsmParameterGetter =
  <TExtra extends Record<string, unknown>>(getSsmPath: (args: TExtra) => string) =>
  (argsAndMaybeOptions: TExtra & GetSsmParameterOptions) => {
    const { cacheDurationMilliseconds, ...targs } = argsAndMaybeOptions;
    return getSsmParameter(getSsmPath(targs as TExtra), cacheDurationMilliseconds);
  };

export const getHrmStaticKey = createSsmParameterGetter(getHrmStaticKeySsmPath);
export const getTwilioStaticKey = createSsmParameterGetter(getTwilioStaticKeySsmPath);
export const getTwilioAuthToken = createSsmParameterGetter(getTwilioAuthTokenSsmPath);
export const getTwilioAccountSid = createSsmParameterGetter(getTwilioAccountSidSsmPath);
export const getTwilioShortHelpline = createSsmParameterGetter(
  getTwilioShortHelplineSsmPath,
);
export const getS3DocsBucketName = createSsmParameterGetter(getS3DocsBucketNameSsmPath);
export const getPermissionConfig = createSsmParameterGetter(getPermissionConfigSsmPath);
export const getEntityNotificationsTopicArn = createSsmParameterGetter(
  getEntityNotificationsTopicArnSsmPath,
);
export const getCompletedContactJobsQueueUrl = createSsmParameterGetter(
  getCompletedContactJobsQueueUrlSsmPath,
);
export const getContactJobsQueueUrl = createSsmParameterGetter(
  getContactJobsQueueUrlSsmPath,
);
export const getResourcesSearchIndexQueueUrl = createSsmParameterGetter(
  getResourcesSearchIndexQueueUrlSsmPath,
);
export const getContactJobScrubTranscriptEnabled = createSsmParameterGetter(
  getContactJobScrubTranscriptEnabledSsmPath,
);
export const getTranscriptRetentionDays = createSsmParameterGetter(
  getTranscriptRetentionDaysSsmPath,
);
export const getIndexTranscriptsForSearch = createSsmParameterGetter(
  getIndexTranscriptsForSearchSsmPath,
);
export const getBeaconBaseUrl = createSsmParameterGetter(getBeaconBaseUrlSsmPath);
export const getBeaconApiKey = createSsmParameterGetter(getBeaconApiKeySsmPath);
export const getBeaconLatestSeen = createSsmParameterGetter(getBeaconLatestSeenSsmPath);
export const getResourcesImportApiBaseUrl = createSsmParameterGetter(
  getResourcesImportApiBaseUrlSsmPath,
);
export const getResourcesImportApiKey = createSsmParameterGetter(
  getResourcesImportApiKeySsmPath,
);
export const getResourcesImportApiAuthHeader = createSsmParameterGetter(
  getResourcesImportApiAuthHeaderSsmPath,
);

export const getAccountStaticKey = async (keyName: string) => {
  try {
    return await getHrmStaticKey({});
  } catch (error) {
    // Remove when a terraform apply has been done for all accounts
    if (error instanceof SsmParameterNotFound && keyName.startsWith('AC')) {
      console.warn(
        `New internal API key not set up for ${keyName} yet, looking for legacy key`,
      );

      return getTwilioStaticKey(keyName);
    }

    throw error;
  }
};
