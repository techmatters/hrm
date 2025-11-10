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

import type { AuthSecretsLookup } from '@tech-matters/twilio-worker-auth';
import { getFromSSMCache } from './ssmConfigurationCache';
import { getSsmParameter, SsmParameterNotFound } from '@tech-matters/ssm-cache';

const lookupLocalOverride = (overrideEnvVarName: string, key: string) => {
  console.debug(
    `Checking for local overrides on ${overrideEnvVarName} (for key: ${key})`,
  );
  const localPermissionsOverrideJson = process.env[overrideEnvVarName];
  if (localPermissionsOverrideJson) {
    const localOverridesMap = JSON.parse(localPermissionsOverrideJson);
    const localOverride = localOverridesMap[key];
    if (localOverride) {
      console.warn(
        `Overriding ${overrideEnvVarName}[${key}] with local value:`,
        localOverride,
      );
      return localOverride;
    }
  }
  return undefined;
};

const authTokenLookup = async (accountSid: string) => {
  console.debug(`Looking up auth token for '${accountSid}'`);
  const localOverride = lookupLocalOverride('AUTH_TOKEN_LOCAL_OVERRIDE', accountSid);
  if (localOverride) {
    return localOverride;
  }
  const { authToken } = await getFromSSMCache(accountSid);
  return authToken;
};

const staticKeyLookup = async (keyName: string) => {
  console.debug(`Looking up static key for '${keyName}'`);
  const localOverride = lookupLocalOverride('STATIC_KEYS_LOCAL_OVERRIDE', keyName);
  if (localOverride) {
    return localOverride;
  }
  try {
    return await getSsmParameter(
      `/${process.env.NODE_ENV}/hrm/service/${
        process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
      }/static_key/${keyName}`,
    );
  } catch (error) {
    // Fall back to the auth token if the internal API static key hasn't been set up, because at the point of switchover, they are the same
    // Remove when a terraform apply has been done for all accounts
    if (error instanceof SsmParameterNotFound && keyName.startsWith('AC')) {
      console.warn(
        `Internal API key not set up for ${keyName} yet, looking for twilio auth token`,
      );
      return getSsmParameter(`/${process.env.NODE_ENV}/twilio/${keyName}/auth_token`);
    } else throw error;
  }
};

export const defaultAuthSecretsLookup: AuthSecretsLookup = {
  authTokenLookup,
  staticKeyLookup,
};
