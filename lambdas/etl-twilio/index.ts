import type { HrmAccountId } from '@tech-matters/types';
import { loadSsmCache, ssmCache } from '@tech-matters/ssm-cache';
import { exportTaskrouterEvents } from './taskrouter';
import { exportStudioExecutions } from './studio';
import { exportDailyUsage } from './usage';

const dateLakeBucketName = process.env.DL_BUCKET || '';
const parentPath = 'twilio';

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
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  await loadSsmCacheConfig();

  const accountSids = Object.entries(ssmCache.values)
    .filter(([key]) => key.includes('/account_sid'))
    .map(([, v]) => v!.value);

  console.log('accountSids: ', accountSids);

  for (const accountSid of accountSids) {
    console.log('accountSid: ', accountSid);

    const exportParams = {
      accountSid: accountSid as HrmAccountId,
      endDate,
      startDate,
      dateLakeBucketName,
      parentPath,
    };

    await Promise.all([
      exportTaskrouterEvents(exportParams),
      exportStudioExecutions(exportParams),
      exportDailyUsage(exportParams),
    ]);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `testing...`,
  };
};
