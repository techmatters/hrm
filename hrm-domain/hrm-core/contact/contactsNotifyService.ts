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
import { publishContactChangeNotification } from '../notifications/entityChangeNotify';
import { maxPermissions } from '../permissions';
import { Transform } from 'stream';
import { streamContactsAfterNotified } from './contactDataAccess';
import { TKConditionsSets } from '../permissions/rulesMap';

// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;

export const processContactsStream = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
  operation: 'reindex' | 'republish',
): Promise<Transform> => {
  if (operation !== 'reindex' && operation !== 'republish')
    throw new Error(`Invalid operation: ${operation}`);

  const searchParameters = {
    dateFrom,
    dateTo,
    onlyDataContacts: false,
    shouldIncludeUpdatedAt: true,
  };

  console.debug('Querying DB for contacts to index', searchParameters);
  const contactsStream: NodeJS.ReadableStream = await streamContactsAfterNotified({
    accountSid,
    searchParameters,
    user: maxPermissions.user,
    viewPermissions: maxPermissions.permissions
      .viewContact as TKConditionsSets<'contact'>,
    batchSize: highWaterMark,
  });

  console.debug('Piping contacts to queue for reindexing', searchParameters);
  return contactsStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark,
      async transform(contact, _, callback) {
        try {
          const { MessageId } = await publishContactChangeNotification({
            accountSid,
            contact,
            operation,
          });

          this.push(
            `${new Date().toISOString()}, ${accountSid}, contact id: ${
              contact.id
            } Success, MessageId ${MessageId}
              \n`,
          );
        } catch (err) {
          this.push(
            `${new Date().toISOString()}, ${accountSid}, contact id: ${
              contact.id
            } Error: ${err.message?.replace('"', '""') || String(err)}\n`,
          );
        }
        callback();
      },
    }),
  );
};
