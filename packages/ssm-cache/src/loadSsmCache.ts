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
  hasCacheExpired,
  setCacheDurationMilliseconds,
  isConfigNotEmpty,
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
/**
 * Loads the parameters under each config's path, as loadParametersByPath does, unless they were loaded and haven't expired.
 */
export const loadSsmCache = async ({
  cacheDurationMilliseconds,
  configs,
}: LoadSsmCacheParameters) => {
  if (isConfigNotEmpty() && !hasCacheExpired()) return;
  if (cacheDurationMilliseconds) setCacheDurationMilliseconds(cacheDurationMilliseconds);

  ssmCache.expiryDate = new Date(Date.now() + ssmCache.cacheDurationMilliseconds);

  const promises = configs.map(async config => loadParametersByPath(config));
  await Promise.all(promises);
};
