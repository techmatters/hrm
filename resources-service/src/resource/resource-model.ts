import { AccountSID } from '@tech-matters/twilio-worker-auth';
import { getById, ReferreableResource } from './resource-data-access';

export const getResource = (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferreableResource | null> => getById(accountSid, resourceId);
