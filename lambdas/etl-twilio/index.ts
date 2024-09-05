import type { HrmAccountId } from '@tech-matters/types';
import { getTaskrouterEvents } from './taskrouter';
import { loadSsmCache, ssmCache } from '@tech-matters/ssm-cache';
import { getSudioExecutions } from './studio';
import { getUsageStatistics } from './usage';

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

    const [taskrouterEvents, studioExecutions, usageStats] = await Promise.all([
      getTaskrouterEvents({
        accountSid: accountSid as HrmAccountId,
        endDate,
        startDate,
      }),
      getSudioExecutions({
        accountSid: accountSid as HrmAccountId,
        endDate,
        startDate,
      }),
      getUsageStatistics({
        accountSid: accountSid as HrmAccountId,
        endDate,
        startDate,
      }),
    ]);

    console.log('results for account', accountSid);
    console.log('taskrouterEvents', taskrouterEvents);
    console.log('studioExecutions', studioExecutions);
    console.log('usageStats', usageStats);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `testing...`,
  };
};
