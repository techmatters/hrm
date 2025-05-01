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
import { caseRecordToCase, getTimelineForCase } from './caseService';
import { publishCaseChangeNotification } from '../notifications/entityChangeNotify';
import { maxPermissions } from '../permissions';
import formatISO from 'date-fns/formatISO';
import { CaseRecord, streamCasesForReindexing } from './caseDataAccess';
import { TKConditionsSets } from '../permissions/rulesMap';
import { Transform } from 'stream';

// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;

export const reindexCasesStream = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
): Promise<Transform> => {
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

  console.debug('Querying DB for cases to index', filters);
  const casesStream: NodeJS.ReadableStream = await streamCasesForReindexing({
    accountSid,
    filters,
    user: maxPermissions.user,
    viewCasePermissions: maxPermissions.permissions.viewCase as TKConditionsSets<'case'>,
    batchSize: highWaterMark,
  });

  console.debug('Piping cases to queue for reindexing', filters);
  return casesStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark,
      async transform(caseRecord: CaseRecord, _, callback) {
        const caseObj = caseRecordToCase(caseRecord);
        try {
          const { MessageId } = await publishCaseChangeNotification({
            accountSid,
            timeline: await getTimelineForCase(accountSid, maxPermissions, caseRecord),
            case: caseObj,
            operation: 'reindex',
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
