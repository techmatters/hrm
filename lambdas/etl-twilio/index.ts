import type { HrmAccountId } from '@tech-matters/types';
import { getTaskrouterEvents } from './taskrouter';
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
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  await loadSsmCacheConfig();

  console.log(ssmCache.values);

  const accountSids = Object.values(ssmCache.values).map(v => v!.value);
  console.log('accountSids: ', accountSids);

  for (const accountSid of accountSids) {
    console.log('accountSid: ', accountSid);

    const taskrouterEvents = await getTaskrouterEvents({
      accountSid: accountSid as HrmAccountId,
      endDate,
      startDate,
    });

    console.log(taskrouterEvents);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: `testing...`,
  };
};
