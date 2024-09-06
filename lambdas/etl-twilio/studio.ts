import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import { putS3Object } from '@tech-matters/s3-client';

export const exportStudioExecutions = async ({
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

  const flows = await client.studio.v2.flows.list();
  const executions = (
    await Promise.all(
      flows.map(f =>
        f.executions().list({ dateCreatedFrom: startDate, dateCreatedTo: endDate }),
      ),
    )
  ).flat();

  await Promise.all(
    executions.map(e => {
      const { dateCreated, sid } = e;
      const key = `${parentPath}/${accountSid}/taskrouter/${accountSid}/${dateCreated.toISOString()}-${sid}`;
      return putS3Object({
        bucket: dateLakeBucketName,
        key,
        body: JSON.stringify(e),
      });
    }),
  );
};
