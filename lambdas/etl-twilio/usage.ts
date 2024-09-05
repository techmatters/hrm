import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';

export const getUsageStatistics = async ({
  accountSid,
  startDate,
  endDate,
}: {
  accountSid: HrmAccountId;
  startDate: Date;
  endDate: Date;
}) => {
  const client = await getClient({ accountSid });

  const usage = await client.usage.records?.daily?.list({ startDate, endDate });

  return usage;
};
