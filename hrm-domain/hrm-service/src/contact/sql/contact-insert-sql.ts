/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { pgp } from '../../connection-pool';
import { ContactRawJson } from '../contact-json';
import { selectSingleContactByTaskId } from './contact-get-sql';

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
  taskId: string;
  channelSid?: string;
  serviceSid?: string;
  caseId?: string;
};

export const insertContactSql = (
  contact: NewContactRecord & { accountSid: string; createdAt: Date; updatedAt: Date },
) => `
WITH inserted AS (
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
  ON CONFLICT ("taskId", "accountSid") DO NOTHING
  RETURNING *
)
SELECT "inserted".*, NULL AS "csamReports", NULL AS "referrals", NULL AS "conversationMedia", true AS "isNewRecord" FROM inserted
UNION
SELECT "existing".*, false AS "isNewRecord" FROM 
(
    ${pgp.as.format(selectSingleContactByTaskId('Contacts'), {
      taskId: contact.taskId,
      accountSid: contact.accountSid,
    })}
) AS existing WHERE existing.id NOT IN (SELECT id FROM inserted)`;
