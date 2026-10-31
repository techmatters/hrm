/**
 * Copyright (C) 2021-2025 Technology Matters
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
  GetParametersByPathCommand,
  GetParametersByPathCommandInput,
} from '@aws-sdk/client-ssm';

import {
  ssmCache,
  getSsmClient,
  addToCache,
  SsmClientCredentials,
  setCacheDurationMilliseconds,
} from './ssmCache';

type LoadParametersByPathParameters = {
  path: string;
  regex?: RegExp;
  nextToken?: string;
  // Defaults to the shared client's credentials, pass them to read with others (e.g. an assumed role)
  credentials?: SsmClientCredentials;
};
/**
 * Loads every parameter under the path (recursively) into the cache, 10 per request.
 * The regex only filters which of them are cached, every parameter under the path is still read from SSM.
 * To load parameters whose names are known, use loadParametersByName instead.
 */
export const loadParametersByPath = async ({
  path,
  regex,
  nextToken,
  credentials,
}: LoadParametersByPathParameters): Promise<void> => {
  const params: GetParametersByPathCommandInput = {
    MaxResults: 10, // 10 is max allowed by AWS
    Path: path,
    Recursive: true,
    WithDecryption: true,
  };

  if (nextToken) params.NextToken = nextToken;

  const command = new GetParametersByPathCommand(params);

  const resp = await getSsmClient(credentials).send(command);

  resp.Parameters?.forEach(p => addToCache(regex, p, credentials));

  if (resp.NextToken) {
    await loadParametersByPath({
      path,
      regex,
      nextToken: resp.NextToken,
      credentials,
    });
  }
};
export type SsmCacheConfig = {
  path: string;
  regex?: RegExp;
};
export type LoadSsmCacheParameters = {
  cacheDurationMilliseconds?: number;
  // We accept an array of types to allow loading parameters from multiple paths
  configs: SsmCacheConfig[];
};
// loadSsmCache always loads with the shared client's credentials, so they aren't part of the key
const toConfigKey = ({ path, regex }: SsmCacheConfig) => `${path}|${regex?.source ?? ''}`;

const hasConfigExpired = (config: SsmCacheConfig) => {
  const expiryDate = ssmCache.byPathExpiryDates[toConfigKey(config)];
  return !expiryDate || new Date() > expiryDate;
};

// Loads currently waiting on SSM, so concurrent calls for the same config share one load
const inFlightConfigLoads: Record<string, Promise<void> | undefined> =
  Object.create(null);

const loadConfigOnce = (config: SsmCacheConfig, expiryDate: Date): Promise<void> => {
  const key = toConfigKey(config);
  const inFlightLoad = inFlightConfigLoads[key];
  if (inFlightLoad) return inFlightLoad;

  const load = loadParametersByPath(config)
    .then(() => {
      // Only set once loaded, so a failed or partial load is retried on the next call
      ssmCache.byPathExpiryDates[key] = expiryDate;
    })
    .finally(() => {
      delete inFlightConfigLoads[key];
    });
  inFlightConfigLoads[key] = load;
  return load;
};

/**
 * Loads the parameters under each config's path, as loadParametersByPath does.
 * Each config is loaded unless it was loaded successfully before and hasn't expired, regardless of what else is in the cache.
 */
export const loadSsmCache = async ({
  cacheDurationMilliseconds,
  configs,
}: LoadSsmCacheParameters) => {
  const expiredConfigs = configs.filter(hasConfigExpired);
  if (!expiredConfigs.length) return;
  if (cacheDurationMilliseconds) setCacheDurationMilliseconds(cacheDurationMilliseconds);

  // Worked out before loading, so a config never outlives the parameters it cached
  const expiryDate = new Date(Date.now() + ssmCache.cacheDurationMilliseconds);
  await Promise.all(expiredConfigs.map(config => loadConfigOnce(config, expiryDate)));
};
