import { pgp } from '../../connection-pool';
import { ContactRawJson } from '../contact-json';

export type NewContactRecord = {
  rawJson: ContactRawJson;
  queueName: string;
  twilioWorkerId?: string;
  createdBy?: string;
  helpline?: string;
  number?: string;
  channel?: string;
  conversationDuration: number;
  timeOfContact?: Date;
  taskId?: string;
  channelSid?: string;
  serviceSid?: string;
};

export const insertContactSql = (
  contact: NewContactRecord & { accountSid: string; createdAt: Date; updatedAt: Date },
) => `
  ${pgp.helpers.insert(
    contact,
    [
      'accountSid',
      'rawJson',
      'queueName',
      'twilioWorkerId',
      'createdBy',
      'createdAt',
      'updatedAt',
      'helpline',
      'channel',
      'number',
      'conversationDuration',
      'timeOfContact',
      'taskId',
      'channelSid',
      'serviceSid',
    ],
    'Contacts',
  )}
  RETURNING *
`;
