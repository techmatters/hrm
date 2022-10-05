import { SSM } from 'aws-sdk';

const ssm = new SSM();

type Config = {
  values: Record<string, string | undefined>;
  expiryDate?: Date;
};

export let config: Config = { values: {} };

export const loadParameters = async ({
  regex,
  expiryTime: cacheDuration = 3600000,
}: {
  regex?: RegExp;
  expiryTime?: number;
} = {}) => {
  if (!config.expiryDate) {
    config.expiryDate = new Date(Date.now() + cacheDuration);
  }

  if (isConfigNotEmpty() && !hasCacheExpired()) return;

  config.values = {};
  await loadPaginatedParameters({ regex });
};

const loadPaginatedParameters = async ({
  regex,
  nextToken,
}: {
  regex?: RegExp;
  nextToken?: string;
}): Promise<void> => {
  const resp = await ssm
    .getParametersByPath({
      MaxResults: 10, // 10 is max allowed by AWS
      Path: `/${process.env.hrm_env}`,
      Recursive: true,
      WithDecryption: true,
      NextToken: nextToken,
    })
    .promise();

  resp.Parameters?.forEach(({ Name, Value }) => {
    if (!Name) return;
    if (regex && !regex.test(Name)) return;

    config.values[Name] = Value;
  });

  if (resp.NextToken) {
    await loadPaginatedParameters({
      regex,
      nextToken: resp.NextToken,
    });
  }
};

const hasCacheExpired = () => config.expiryDate && new Date() > config.expiryDate;

const isConfigNotEmpty = () => Object.keys(config.values).length;
