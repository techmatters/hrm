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
  SSMClient,
  SSMClientConfig,
  GetParameterCommand,
  GetParametersCommand,
  Parameter as SsmParameter,
  ParameterNotFound,
  PutParameterCommand,
  PutParameterCommandInput,
  ParameterAlreadyExists,
} from '@aws-sdk/client-ssm';

const convertToEndpoint = (endpointUrl: string) => {
  const url: URL = new URL(endpointUrl);
  return {
    url: url,
  };
};

const getSsmConfig = () => {
  const ssmConfig: SSMClientConfig = {};
  ssmConfig.region = 'us-east-1';

  if (process.env.SSM_ENDPOINT) {
    ssmConfig.region = 'us-east-1';
    ssmConfig.endpoint = convertToEndpoint(process.env.SSM_ENDPOINT);
    ssmConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'mock-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'mock-secret-key',
    };
  }

  if (process.env.LOCAL_SSM_PORT) {
    ssmConfig.region = 'us-east-1';
    ssmConfig.endpoint = convertToEndpoint(
      `http://localhost:${process.env.LOCAL_SSM_PORT}`,
    );
    ssmConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'mock-access-key',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'mock-secret-key',
    };
  }

  if (process.env.SSM_REGION) {
    ssmConfig.region = process.env.SSM_REGION;
  }

  return ssmConfig;
};

let ssm: SSMClient;

export class SsmParameterNotFound extends Error {
  constructor(parameterName: string, cause?: ParameterNotFound) {
    super(`SSM parameter ${parameterName} not found in parameter store`);

    // see: https://github.com/microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, SsmParameterNotFound.prototype);
    this.name = 'SsmParameterNotFound';
    this.parameterName = parameterName;
    this.cause = cause;
  }

  public parameterName: string;
}

export class SsmParameterAlreadyExists extends Error {
  constructor(message: string) {
    super(message);

    // see: https://github.com/microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, SsmParameterAlreadyExists.prototype);
    this.name = 'SsmParameterAlreadyExists';
  }
}

export type SsmCacheParameter = {
  value: string | Error;
  expiryDate: Date;
};

export type SsmCache = {
  values: Record<string, SsmCacheParameter | undefined>;
  expiryDate?: Date;
  cacheDurationMilliseconds: number;
  errorCacheDurationMilliseconds: number;
};

export const ssmCache: SsmCache = {
  values: {},
  cacheDurationMilliseconds: 3600000,
  errorCacheDurationMilliseconds: 60 * 1000 * 5, // 5 minutes,
};

export const hasParameterExpired = (parameter: SsmCacheParameter | undefined) => {
  return !!(parameter?.expiryDate && new Date() > parameter.expiryDate);
};

export const hasCacheExpired = () =>
  !!(ssmCache.expiryDate && new Date() > ssmCache.expiryDate);

export const isConfigNotEmpty = () => !!Object.keys(ssmCache.values).length;

export const setCacheDurationMilliseconds = (cacheDurationMilliseconds: number) => {
  ssmCache.cacheDurationMilliseconds = cacheDurationMilliseconds;
};

export type SsmClientCredentials = SSMClientConfig['credentials'];

/**
 * Returns a getter for something kept per SSM client: the shared one's if no credentials are given, otherwise the one
 * for those credentials (the same object), created the first time they are passed and reused after that.
 * Keeping them apart means nothing done with some credentials (e.g. an assumed role) leaks to callers using others.
 */
const perSsmClient = <T>(
  getShared: () => T,
  createForCredentials: (credentials: NonNullable<SsmClientCredentials>) => T,
) => {
  const byCredentials = new WeakMap<NonNullable<SsmClientCredentials>, T>();
  return (credentials?: SsmClientCredentials): T => {
    if (!credentials) return getShared();
    if (!byCredentials.has(credentials)) {
      byCredentials.set(credentials, createForCredentials(credentials));
    }
    return byCredentials.get(credentials)!;
  };
};

// Values (or errors) loaded with some credentials are only returned to callers using the same ones,
// as other credentials may not be allowed to read them, or may be allowed when these were not
const getCachedValues = perSsmClient<SsmCache['values']>(
  () => ssmCache.values,
  () => ({}),
);

// If the value is falsy, we take that to means that the parameter doesn't exist in addition to just a missing name
export const parameterExistsInCache = (
  name: string,
  credentials?: SsmClientCredentials,
): boolean => !!getCachedValues(credentials)[name]?.value;

/**
 * Returns the shared client, or, if credentials are given (e.g. from an assumed role), the client using them.
 */
export const getSsmClient = perSsmClient(
  () => {
    if (!ssm) {
      ssm = new SSMClient(getSsmConfig());
    }
    return ssm;
  },
  credentials => new SSMClient({ ...getSsmConfig(), credentials }),
);

export const addToCache = (
  regex: RegExp | undefined,
  { Name, Value }: SsmParameter,
  credentials?: SsmClientCredentials,
) => {
  if (!Name) return;
  if (regex && !regex.test(Name)) return;

  getCachedValues(credentials)[Name] = {
    value: Value || '',
    expiryDate: new Date(Date.now() + ssmCache.cacheDurationMilliseconds),
  };
};

export const addErrorToCache = (
  parameterName: string,
  errorToCache: Error,
  credentials?: SsmClientCredentials,
) => {
  getCachedValues(credentials)[parameterName] = {
    value: errorToCache,
    expiryDate: new Date(Date.now() + ssmCache.errorCacheDurationMilliseconds),
  };
};

export const loadParameterByName = async (
  name: string,
  credentials?: SsmClientCredentials,
) => {
  const params = {
    Name: name,
    WithDecryption: true,
  };

  const command = new GetParameterCommand(params);
  try {
    const { Parameter } = await getSsmClient(credentials).send(command);
    if (Parameter?.Name) {
      addToCache(undefined, Parameter, credentials);
    } else {
      addErrorToCache(
        name,
        new Error(`Invalid parameter returned looking up ${name}: ${Parameter}`),
        credentials,
      );
    }
  } catch (e) {
    addErrorToCache(name, e as Error, credentials);
  }
};

const GET_PARAMETERS_MAX_NAMES = 10; // 10 is max allowed by AWS

/**
 * Loads the named parameters into the cache with one request per 10 names, rather than one request per name,
 * sending them one at a time as SSM rate limits are low.
 * Names that don't exist are cached as not found, like loadParameterByName does.
 */
export const loadParametersByName = async (
  names: string[],
  credentials?: SsmClientCredentials,
) => {
  for (let start = 0; start < names.length; start += GET_PARAMETERS_MAX_NAMES) {
    const command = new GetParametersCommand({
      Names: names.slice(start, start + GET_PARAMETERS_MAX_NAMES),
      WithDecryption: true,
    });
    const { Parameters, InvalidParameters } =
      await getSsmClient(credentials).send(command);

    Parameters?.forEach(parameter => addToCache(undefined, parameter, credentials));
    InvalidParameters?.forEach(name =>
      addErrorToCache(
        name,
        new ParameterNotFound({ message: `Parameter ${name} not found`, $metadata: {} }),
        credentials,
      ),
    );
  }
};

type InFlightParameterLoads = Record<string, Promise<void> | undefined>;

const sharedInFlightParameterLoads: InFlightParameterLoads = Object.create(null);

// Loads currently waiting on SSM, so concurrent lookups of the same parameter with the same credentials share one request
const getInFlightParameterLoads = perSsmClient<InFlightParameterLoads>(
  () => sharedInFlightParameterLoads,
  () => Object.create(null),
);

const loadParameterByNameOnce = (
  name: string,
  credentials?: SsmClientCredentials,
): Promise<void> => {
  const inFlightParameterLoads = getInFlightParameterLoads(credentials);
  const inFlightLoad = inFlightParameterLoads[name];
  if (inFlightLoad) return inFlightLoad;

  const load = loadParameterByName(name, credentials).finally(() => {
    delete inFlightParameterLoads[name];
  });
  inFlightParameterLoads[name] = load;
  return load;
};

export const getSsmParameter = async (
  name: string,
  cacheDurationMilliseconds?: number,
  // Defaults to the shared client's credentials, pass them to read with others (e.g. an assumed role)
  credentials?: SsmClientCredentials,
): Promise<string> => {
  const oldCacheDurationMilliseconds = ssmCache.cacheDurationMilliseconds;
  if (cacheDurationMilliseconds) setCacheDurationMilliseconds(cacheDurationMilliseconds);

  // If the cache doesn't have the requested parameter or if it is expired, load it
  if (
    !parameterExistsInCache(name, credentials) ||
    hasParameterExpired(getCachedValues(credentials)[name])
  ) {
    await loadParameterByNameOnce(name, credentials);
  }
  setCacheDurationMilliseconds(oldCacheDurationMilliseconds);

  // If the cache still doesn't have the requested parameter, throw an error
  // Shouldn't happen, an error should be cached here from a previous attempt if not found
  if (!parameterExistsInCache(name, credentials)) {
    throw new SsmParameterNotFound(name);
  }
  const value = getCachedValues(credentials)[name]?.value || '';
  if (value instanceof ParameterNotFound) throw new SsmParameterNotFound(name, value);
  if (value instanceof Error) throw value;
  return value;
};

export const putSsmParameter = async (
  name: string,
  value: string,
  { cacheValue = true, overwrite = false, secure = false } = {},
) => {
  const params: PutParameterCommandInput = {
    Name: name,
    Value: value,
    Overwrite: overwrite,
    Type: secure ? 'SecureString' : 'String',
  };
  const command = new PutParameterCommand(params);
  try {
    await getSsmClient().send(command);
    if (cacheValue) {
      addToCache(undefined, { Name: name, Value: value });
    } else {
      // Invalidate the cache entry if we're not caching the value
      delete ssmCache.values[name];
    }
  } catch (e) {
    if (e instanceof ParameterNotFound) {
      return;
    }
    if (e instanceof ParameterAlreadyExists) {
      throw new SsmParameterAlreadyExists(
        `Parameter ${name} already exists and overwrite flag was not set`,
      );
    }
    throw e;
  }
};

export const getCachedParameters = (
  filterRegex: RegExp,
  // Defaults to the values read with the shared client's credentials
  credentials?: SsmClientCredentials,
): Record<string, string> => {
  const validCacheEntries = Object.entries(getCachedValues(credentials)).filter(
    ([key, value]) =>
      filterRegex.test(key) &&
      typeof value?.value === 'string' &&
      !hasParameterExpired(value),
  );
  return Object.fromEntries(validCacheEntries.map(([k, v]) => [k, v?.value])) as Record<
    string,
    string
  >;
};
