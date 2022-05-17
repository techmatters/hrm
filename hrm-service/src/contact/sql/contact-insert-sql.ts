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
) =>
  `WITH inserted AS (
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
    ),
    csamConnect AS (
      UPDATE "CSAMReports" SET "contactId"=inserted."id" FROM inserted WHERE "CSAMReports"."id" = ANY(ARRAY[$<csamReportIds:csv>]::integer[]) RETURNING "CSAMReports".*
    )  
    SELECT c.*, reports."csamReports" 
        FROM inserted AS c
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS "csamReports" 
          FROM csamConnect r 
          WHERE r."contactId" = c.id AND r."accountSid" = c."accountSid"
        ) reports ON true
`;
