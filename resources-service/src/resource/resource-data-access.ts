import { db } from '../connection-pool';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import { SELECT_RESOURCE_BY_ID } from './sql/resource-get-sql';

export type ReferreableResource = {
  name: string;
  id: string;
};

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferreableResource | null> =>
  db.task(async t => t.oneOrNone(SELECT_RESOURCE_BY_ID, { accountSid, resourceId }));
