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
import { publishProfileChangeNotification } from '../notifications/entityChangeNotify';
import { maxPermissions } from '../permissions';
import formatISO from 'date-fns/formatISO';
import { CaseRecord, streamCasesForRenotifying } from './caseDataAccess';
import { TKConditionsSets } from '../permissions/rulesMap';
import { Transform } from 'stream';

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
  const filters = {
    createdAt: {
      from: formatISO(new Date(dateFrom)),
      to: formatISO(new Date(dateTo)),
    },
    updatedAt: {
      from: formatISO(new Date(dateFrom)),
      to: formatISO(new Date(dateTo)),
    },
  };

  console.debug(`Querying DB for cases to ${operation}`, filters);
  const casesStream: NodeJS.ReadableStream = await streamCasesForRenotifying({
    accountSid,
    filters,
    user: maxPermissions.user,
    viewCasePermissions: maxPermissions.permissions.viewCase as TKConditionsSets<'case'>,
    batchSize: highWaterMark,
  });

  console.debug(`Piping cases to queue for ${operation}ing`, filters);
  return casesStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark,
      async transform(caseRecord: CaseRecord, _, callback) {
        const caseObj = caseRecordToCase(caseRecord);
        try {
          const { MessageId } = await publishProfileChangeNotification({
            accountSid,
            timeline: await getTimelineForCase(accountSid, maxPermissions, caseObj),
            case: caseObj,
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
