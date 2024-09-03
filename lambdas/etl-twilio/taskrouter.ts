import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';

export const getTaskrouterEvents = async ({
  accountSid,
  startDate,
  endDate,
}: {
  accountSid: HrmAccountId;
  startDate: Date;
  endDate: Date;
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

  return events;
};
