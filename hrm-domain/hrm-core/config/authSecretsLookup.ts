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

const staticKeyLookup = async (keySuffix: string) => {
  console.debug(`Looking up static key for '${keySuffix}'`);
  const localOverride = lookupLocalOverride('STATIC_KEYS_LOCAL_OVERRIDE', keySuffix);
  if (localOverride) {
    return localOverride;
  }
  const { staticKey } = await getFromSSMCache(keySuffix);
  return staticKey;
};

export const defaultAuthSecretsLookup: AuthSecretsLookup = {
  authTokenLookup,
  staticKeyLookup,
};
