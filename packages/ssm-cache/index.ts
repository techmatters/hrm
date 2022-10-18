import { SSM } from 'aws-sdk';

// This is based around the pattern found in https://github.com/ryands17/lambda-ssm-cache

// This allows endpoint override for localstack I haven't found a better way to do this globally yet
const ssmConfig = process.env.SSM_ENDPOINT ? { endpoint: process.env.SSM_ENDPOINT } : {};

const ssm = new SSM(ssmConfig);

export type SsmCache = {
  values: Record<string, string | undefined>;
  expiryDate?: Date;
};

export const ssmCache: SsmCache = { values: {} };

export const getSsmParameter = (name: string): string => {
  if (!Object.prototype.hasOwnProperty.call(ssmCache.values, name)) {
    throw new Error(`SSM parameter ${name} not found in cache`);
  }

  return ssmCache.values[name] || '';
};

export const addToCache = (regex: RegExp | undefined, { Name, Value }: SSM.Parameter) => {
  if (!Name) return;
  if (regex && !regex.test(Name)) return;

  ssmCache.values[Name] = Value;
};

const hasCacheExpired = () => !!(ssmCache.expiryDate && new Date() > ssmCache.expiryDate);

const isConfigNotEmpty = () => !!Object.keys(ssmCache.values).length;

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

  const resp = await ssm.getParametersByPath(params).promise();

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
  expiryTime?: number;
  // We accept an array of types to allow loading parameters from multiple paths
  configs: SsmCacheConfig[];
};

export const loadSsmCache = async ({
  expiryTime: cacheDuration = 3600000,
  configs,
}: LoadSsmCacheParameters) => {
  if (!ssmCache.expiryDate) {
    ssmCache.expiryDate = new Date(Date.now() + cacheDuration);
  }

  if (isConfigNotEmpty() && !hasCacheExpired()) return;

  // do we need to clear ssmCache for this path or is overwriting values
  // okay for our use case? (rbd - 06/10/22)
  const promises = configs.map(async config => loadPaginated(config));

  await Promise.all(promises);
};

type LoadPaginatedParameters = {
  path: string;
  regex?: RegExp;
  nextToken?: string;
};
