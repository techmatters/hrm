import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import { putS3Object } from '@tech-matters/s3-client';

export const exportDailyUsage = async ({
  accountSid,
  startDate,
  endDate,
  dateLakeBucketName,
  parentPath,
}: {
  accountSid: HrmAccountId;
  startDate: Date;
  endDate: Date;
  dateLakeBucketName: string;
  parentPath: string;
}) => {
  const client = await getClient({ accountSid });

  const usage = (await client.usage.records?.daily?.list({ startDate, endDate }))?.filter(
    u => parseInt(u.count, 10) > 0,
  );

  await Promise.all(
    (usage || []).map(u => {
      const { startDate: from, endDate: to, category } = u;
      const key = `${parentPath}/${accountSid}/usage/${accountSid}/${from.toISOString()}-${to.toISOString()}-${category}`;
      return putS3Object({
        bucket: dateLakeBucketName,
        key,
        body: JSON.stringify(u),
      });
    }),
  );
};
