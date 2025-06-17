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

import { publishProfileChangeNotification } from '../notifications/entityChangeNotify';
import formatISO from 'date-fns/formatISO';
import { Transform } from 'stream';
import { streamProfileForRenotifying } from './profileDataAccess';

// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;

export const renotifyProfilesStream = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
  operation: ManuallyTriggeredNotificationOperation,
): Promise<Transform> => {
  if (manuallyTriggeredNotificationOperations.includes(operation)) {
    throw new Error(`Invalid operation: ${operation}`);
  }
  const filters = {
    dateFrom: formatISO(new Date(dateFrom)),
    dateTo: formatISO(new Date(dateTo)),
  };

  console.debug(`Querying DB for profiles to ${operation}`, filters);
  const profilesStream: NodeJS.ReadableStream = await streamProfileForRenotifying({
    accountSid,
    filters,
    batchSize: highWaterMark,
  });

  console.debug(`Piping profiles to queue for ${operation}ing`, filters);
  return profilesStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark,
      async transform(profileRecord: any, _, callback) {
        try {
          const { MessageId } = await publishProfileChangeNotification(profileRecord);

          this.push(
            `${new Date().toISOString()}, ${accountSid}, profile id: ${
              profileRecord.id
            } Success, MessageId ${MessageId}
              \n`,
          );
        } catch (err) {
          this.push(
            `${new Date().toISOString()}, ${accountSid}, case id: ${
              profileRecord.id
            } Error: ${err.message?.replace('"', '""') || String(err)}\n`,
          );
        }
        callback();
      },
    }),
  );
};
