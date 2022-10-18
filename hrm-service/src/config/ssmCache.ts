import { loadSsmCache as loadSsmCacheRoot } from '@tech-matters/hrm-ssm-cache';

export { ssmCache } from '@tech-matters/hrm-ssm-cache';

export { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

const ssmCacheConfigs = [
  {
    path: `/${process.env.NODE_ENV}/sqs/jobs/contact`,
    regex: /queue-url-*./,
  },
];

export const loadSsmCache = async () => {
  await loadSsmCacheRoot({ configs: ssmCacheConfigs });
};
