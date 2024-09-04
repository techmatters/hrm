import type { HrmAccountId } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';

export const getSudioExecutions = async ({
  accountSid,
  startDate,
  endDate,
}: {
  accountSid: HrmAccountId;
  startDate: Date;
  endDate: Date;
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

  return executions;
};
