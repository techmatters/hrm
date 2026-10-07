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

import { createSsmParameterGetter } from '@tech-matters/aselo-config';
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
} from './ssmParameterNameGetters';

export * from './ssmParameterNameGetters';

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
export const getContactJobScrubTranscriptEnabled = createSsmParameterGetter(
  getContactJobScrubTranscriptEnabledSsmPath,
);
export const getTranscriptRetentionDays = createSsmParameterGetter(
  getTranscriptRetentionDaysSsmPath,
);
export const getTwilioAuthToken = createSsmParameterGetter(getTwilioAuthTokenSsmPath);
export const getIndexTranscriptsForSearch = createSsmParameterGetter(
  getIndexTranscriptsForSearchSsmPath,
);
export const getBeaconBaseUrl = createSsmParameterGetter(getBeaconBaseUrlSsmPath);
export const getBeaconApiKey = createSsmParameterGetter(getBeaconApiKeySsmPath);
export const getBeaconDispatchApiVersion = createSsmParameterGetter(
  getBeaconDispatchApiVersionSsmPath,
);
export const getBeaconLatestSeen = createSsmParameterGetter(getBeaconLatestSeenSsmPath);
