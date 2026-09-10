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
  SsmParameterNotFound,
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
    path: `/${process.env.NODE_ENV}/hrm/service/${
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
    }/static_key`,
    regex: /\/.*/,
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

const getAccountStaticKey = async (keyName: string) => {
  try {
    const name = `/${process.env.NODE_ENV}/hrm/service/${
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
    }/static_key/${keyName}`;
    console.debug('[CHI-4005] staticKeyLookup trying to get', name);
    return await getSsmParameter(name);
  } catch (error) {
    // Remove when a terraform apply has been done for all accounts
    if (error instanceof SsmParameterNotFound && keyName.startsWith('AC')) {
      console.warn(
        `New internal API key not set up for ${keyName} yet, looking for legacy key`,
      );

      console.debug('[CHI-4005] staticKeyLookup trying to get', name);

      return getSsmParameter(`/${process.env.NODE_ENV}/twilio/${keyName}/static_key`);
    } else throw error;
  }
};

export const getFromSSMCache = async (accountSid: string) => {
  // does nothing if cache is still valid
  await loadSsmCache();

  // Should be cached already
  return {
    staticKey: await getAccountStaticKey(accountSid),
    authToken: await getSsmParameter(
      `/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`,
    ),
    permissionConfig: await getSsmParameter(
      `/${process.env.NODE_ENV}/config/${accountSid}/permission_config`,
    ),
  };
};
