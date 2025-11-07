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
  loadSsmCache as loadSsmCacheRoot,
  getSsmParameter,
} from '@tech-matters/ssm-cache';

import env from 'dotenv';

env.config();

const ssmCacheConfigs = [
  {
    path: `/${process.env.NODE_ENV}/${
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
    }/sqs/jobs/contact`,
    regex: /queue-url-*/,
  },
  {
    path: `/${process.env.NODE_ENV}/twilio`,
    regex: /\/.*\/static_key/,
  },
  {
    path: `/${process.env.NODE_ENV}/twilio`,
    regex: /\/.*\/auth_token/,
  },
  {
    path: `/${process.env.NODE_ENV}/config`,
    regex: /\/.*\/permission_config/,
  },
];

export const loadSsmCache = async () => {
  await loadSsmCacheRoot({
    configs: ssmCacheConfigs,
    cacheDurationMilliseconds: 3600000 * 24, // cache for a day
  });
};

export const getFromSSMCache = async (accountSid: string) => {
  // does nothing if cache is still valid
  await loadSsmCache();

  // Should be cached already
  return {
    staticKey: await getSsmParameter(
      `/${process.env.NODE_ENV}/twilio/${accountSid}/static_key`,
    ),
    authToken: await getSsmParameter(
      `/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`,
    ),
    permissionConfig: await getSsmParameter(
      `/${process.env.NODE_ENV}/config/${accountSid}/permission_config`,
    ),
  };
};
