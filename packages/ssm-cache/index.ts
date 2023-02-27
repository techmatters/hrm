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

import { SSM } from 'aws-sdk';

// This is based around the pattern found in https://github.com/ryands17/lambda-ssm-cache

// This allows endpoint override for localstack I haven't found a better way to do this globally yet
const ssmConfig: { endpoint?: string; region?: string } = process.env.SSM_ENDPOINT
  ? { endpoint: process.env.SSM_ENDPOINT }
  : {};

if (process.env.SSM_REGION) {
  ssmConfig.region = process.env.SSM_REGION;
}

let ssm: SSM;

export type SsmCacheParameter = {
  value: string;
  expiryDate: Date;
};

export type SsmCache = {
  values: Record<string, SsmCacheParameter | undefined>;
  expiryDate?: Date;
  cacheDurationMilliseconds: number;
};

export const ssmCache: SsmCache = {
  values: {},
  cacheDurationMilliseconds: 3600000,
};

export class SsmParameterNotFound extends Error {
  constructor(message: string) {
    super(message);

    // see: https://github.com/microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, SsmParameterNotFound.prototype);
    this.name = 'SsmParameterNotFound';
  }
}

export const hasParameterExpired = (parameter: SsmCacheParameter | undefined) => {
  return !!(parameter?.expiryDate && new Date() > parameter.expiryDate);
};

export const hasCacheExpired = () => !!(ssmCache.expiryDate && new Date() > ssmCache.expiryDate);

export const isConfigNotEmpty = () => !!Object.keys(ssmCache.values).length;

export const setCacheDurationMilliseconds = (cacheDurationMilliseconds: number) => {
  ssmCache.cacheDurationMilliseconds = cacheDurationMilliseconds;
};

export const parameterExistsInCache = (name: string) =>
  Object.prototype.hasOwnProperty.call(ssmCache.values, name) && ssmCache.values[name];

export const getSsmClient = () => {
  if (!ssm) {
    ssm = new SSM(ssmConfig);
  }

  return ssm;
};

export const addToCache = (regex: RegExp | undefined, { Name, Value }: SSM.Parameter) => {
  if (!Name) return;
  if (regex && !regex.test(Name)) return;

  ssmCache.values[Name] = {
    value: Value || '',
    expiryDate: new Date(Date.now() + ssmCache.cacheDurationMilliseconds),
  };
};

export const loadParameter = async (name: string) => {
  const params: SSM.GetParameterRequest = {
    Name: name,
    WithDecryption: true,
  };

  const { Parameter } = await getSsmClient()
    .getParameter(params)
    .promise();

  if (!Parameter?.Name) {
    return;
  }

  addToCache(undefined, Parameter);
};

export const getSsmParameter = async (name: string): Promise<string> => {
  // If the cache doesn't have the requested parameter or if it is expired, load it

  if (!parameterExistsInCache(name) || hasParameterExpired(ssmCache.values[name])) {
    await loadParameter(name);
  }

  // If the cache still doesn't have the requested parameter, throw an error
  if (!parameterExistsInCache(name)) {
    throw new SsmParameterNotFound(`Parameter ${name} not found`);
  }

  return ssmCache?.values[name]?.value || '';
};

type LoadPaginatedParameters = {
  path: string;
  regex?: RegExp;
  nextToken?: string;
};

export const loadPaginated = async ({
  path,
  regex,
  nextToken,
}: LoadPaginatedParameters): Promise<void> => {
  const params: SSM.GetParametersByPathRequest = {
    MaxResults: 10, // 10 is max allowed by AWS
    Path: path,
    Recursive: true,
    WithDecryption: true,
  };

  if (nextToken) params.NextToken = nextToken;

  const resp = await getSsmClient()
    .getParametersByPath(params)
    .promise();

  resp.Parameters?.forEach(p => addToCache(regex, p));

  if (resp.NextToken) {
    await loadPaginated({
      path,
      regex,
      nextToken: resp.NextToken,
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

export const loadSsmCache = async ({
  cacheDurationMilliseconds,
  configs,
}: LoadSsmCacheParameters) => {
  if (isConfigNotEmpty() && !hasCacheExpired()) return;

  if (cacheDurationMilliseconds) setCacheDurationMilliseconds(cacheDurationMilliseconds);

  ssmCache.expiryDate = new Date(Date.now() + ssmCache.cacheDurationMilliseconds);

  const promises = configs.map(async config => loadPaginated(config));

  await Promise.all(promises);
};
