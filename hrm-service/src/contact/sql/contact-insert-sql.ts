import { pgp } from '../../connection-pool';
import { ContactRawJson } from '../contact-json';

/**
 * @openapi
 * components:
 *   schemas:
 *     ContactRecordBase:
 *       type: object
 *       properties:
 *         queueName:
 *           type: string
 *           example: Admin
 *         twilioWorkerId:
 *           $ref: '#/components/schemas/TwilioWorkerId'
 *         createdBy:
 *           type: string
 *           example: 'user'
 *         helpline:
 *           $ref: '#/components/schemas/Helpline'
 *         number:
 *           $ref: '#/components/schemas/PhoneNumber'
 *         channel:
 *           $ref: '#/components/schemas/Channel'
 *         conversationDuration:
 *           $ref: '#/components/schemas/ConversationDuration'
 *         taskId:
 *           $ref: '#/components/schemas/TaskId'
 *         channelSid:
 *           $ref: '#/components/schemas/Sid'
 *         serviceSid:
 *           $ref: '#/components/schemas/Sid'
 *     NewContactRecord:
 *       allOf:
 *         - $ref: '#/components/schemas/ContactRecordBase'
 *         - type: object
 *           properties:
 *             rawJson:
 *               $ref: '#/components/schemas/ContactRawJson'
 *
 */
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
        ) reports ON true
`;
