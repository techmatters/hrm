import { SSM } from 'aws-sdk';

// This is based around the pattern found in https://github.com/ryands17/lambda-ssm-cache

const ssm = new SSM();

export type SsmCache = {
  values: Record<string, string | undefined>;
  expiryDate?: Date;
};

export let ssmCache: SsmCache = { values: {} };

export type SsmCacheConfig = {
  path: string;
  regex?: RegExp;
};

export type loadSsmCacheParameters = {
  expiryTime?: number;
  // We accept an array of types to allow loading parameters from multiple paths
  configs: SsmCacheConfig[];
};

export const loadSsmCache = async ({
  expiryTime: cacheDuration = 3600000,
  configs,
}: loadSsmCacheParameters) => {
  if (!ssmCache.expiryDate) {
    ssmCache.expiryDate = new Date(Date.now() + cacheDuration);
  }

  if (isConfigNotEmpty() && !hasCacheExpired()) return;

  // do we need to clear ssmCache for this path or is overwriting values
  // okay for our use case? (rbd - 06/10/22)
  const promises = configs.map(async (config) => await loadPaginated(config));

  await Promise.all(promises);
};

type LoadPaginatedParameters = {
  path?: string;
  regex?: RegExp;
  nextToken?: string;
};

const loadPaginated = async ({
  path,
  regex,
  nextToken,
}: LoadPaginatedParameters): Promise<void> => {
  const resp = await ssm
    .getParametersByPath({
      MaxResults: 10, // 10 is max allowed by AWS
      Path: path,
      Recursive: true,
      WithDecryption: true,
      NextToken: nextToken,
    })
    .promise();

  resp.Parameters?.forEach(({ Name, Value }) => {
    if (!Name) return;
    if (regex && !regex.test(Name)) return;

    ssmCache.values[Name] = Value;
  });

  if (resp.NextToken) {
    await loadPaginated({
      path,
      regex,
      nextToken: resp.NextToken,
    });
  }
};

const hasCacheExpired = () => ssmCache.expiryDate && new Date() > ssmCache.expiryDate;

const isConfigNotEmpty = () => Object.keys(ssmCache.values).length;
