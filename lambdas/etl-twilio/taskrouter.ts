import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import { putS3Object } from '@tech-matters/s3-client';

export const getTaskrouterEvents = async ({
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

  const workspaces = await client.taskrouter.v1.workspaces.list();
  const events = (
    await Promise.all(
      workspaces.map(w =>
        client.taskrouter.v1.workspaces(w.sid).events.list({ startDate, endDate }),
      ),
    )
  ).flat();

  console.log('taskrouterEvents', events);

  await Promise.all(
    events.map(e => {
      const { eventDate, sid } = e;
      const key = `${parentPath}/${accountSid}/taskrouter/${accountSid}/${eventDate}-${sid}`;
      return putS3Object({
        bucket: dateLakeBucketName,
        key,
        body: JSON.stringify(e),
      });
    }),
  );

  return events;
};
