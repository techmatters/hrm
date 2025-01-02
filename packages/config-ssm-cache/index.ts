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
  hasCacheExpired,
  loadSsmCache as loadSsmCacheRoot,
  ssmCache,
} from '@tech-matters/ssm-cache';

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
  await loadSsmCacheRoot({ configs: ssmCacheConfigs });
};

export const getFromSSMCache = async (accountSid: string) => {
  if (hasCacheExpired()) {
    await loadSsmCache();
  }

  return {
    staticKey:
      ssmCache.values[`/${process.env.NODE_ENV}/twilio/${accountSid}/static_key`]!.value,
    authToken:
      ssmCache.values[`/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`]!.value,
    permissionConfig:
      ssmCache.values[`/${process.env.NODE_ENV}/config/${accountSid}/permission_config`]!
        .value,
  };
};
