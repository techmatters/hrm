import { loadSsmCache, ssmCache } from '@tech-matters/ssm-cache';

const ssmCacheConfigs = [
  {
    path: `/${process.env.NODE_ENV}/twilio`,
    regex: /\/.*\/account_sid/,
  },
];

const loadSsmCacheConfig = async () => {
  await loadSsmCache({ configs: ssmCacheConfigs });
};

export const handler = async (event: any) => {
  console.log(event);
  console.log('Ok');

  await loadSsmCacheConfig();

  console.log(ssmCache.values);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `testing...`,
  };
};
