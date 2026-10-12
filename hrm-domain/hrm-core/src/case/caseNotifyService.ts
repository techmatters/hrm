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

import { HrmAccountId } from '@tech-matters/types';
import {
  ManuallyTriggeredNotificationOperation,
  manuallyTriggeredNotificationOperations,
} from '@tech-matters/hrm-types';

import { caseRecordToCase, getTimelineForCase } from './caseService';
import { maxPermissions } from '../permissions';
import formatISO from 'date-fns/formatISO';
import { CaseRecord, streamCasesForRenotifying } from './caseDataAccess';
import { Transform } from 'stream';
import { publishCaseChangeNotification } from '../notifications/entityChangeNotify';

// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;

export const renotifyCasesStream = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
  operation: ManuallyTriggeredNotificationOperation,
): Promise<Transform> => {
  if (!manuallyTriggeredNotificationOperations.includes(operation)) {
    throw new Error(`Invalid operation: ${operation}`);
  }
  const from = dateFrom ? formatISO(new Date(dateFrom)) : '-infinity';
  const to = dateTo ? formatISO(new Date(dateTo)) : 'infinity';

  console.debug(`Querying DB for cases to ${operation}`, from, to);
  const casesStream: NodeJS.ReadableStream = await streamCasesForRenotifying({
    accountSid,
    filters: { from, to },
    batchSize: highWaterMark,
  });

  console.debug(`Piping cases to queue for ${operation}ing`, from, to);
  return casesStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark,
      async transform(caseRecord: CaseRecord, _, callback) {
        const caseObj = caseRecordToCase(caseRecord);
        try {
          const { MessageId } = await publishCaseChangeNotification({
            accountSid,
            timeline: await getTimelineForCase(accountSid, maxPermissions, caseObj),
            caseObj,
            operation,
          });

          this.push(
            `${new Date().toISOString()}, ${accountSid}, case id: ${
              caseObj.id
            } Success, MessageId ${MessageId}
              \n`,
          );
        } catch (err) {
          this.push(
            `${new Date().toISOString()}, ${accountSid}, case id: ${caseObj.id} Error: ${
              err.message?.replace('"', '""') || String(err)
            }\n`,
          );
        }
        callback();
      },
    }),
  );
};
