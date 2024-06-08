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

import { HrmAccountId, newErr, newOkFromData } from '@tech-matters/types';
import { Contact, searchContacts } from './contactService';
import { publishContactToSearchIndex } from '../jobs/search/publishToSearchIndex';
import { maxPermissions } from '../permissions';
import {
  AsyncProcessor,
  SearchFunction,
  processInBatch,
} from '@tech-matters/batch-processing';

export const reindexContacts = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
) => {
  try {
    const searchParameters = {
      dateFrom,
      dateTo,
    };

    const searchFunction: SearchFunction<Contact> = async limitAndOffset => {
      const res = await searchContacts(
        accountSid,
        searchParameters,
        limitAndOffset,
        maxPermissions,
      );
      return { records: res.contacts, count: res.count };
    };

    const asyncProcessor: AsyncProcessor<Contact, void> = async contactsResult => {
      const promises = contactsResult.records.map(contact => {
        return publishContactToSearchIndex({
          accountSid,
          contact,
          operation: 'index',
        });
      });

      await Promise.all(promises);
    };

    await processInBatch(searchFunction, asyncProcessor);

    return newOkFromData('Successfully indexed contacts');
  } catch (error) {
    console.error('Error reindexing contacts', error);
    return newErr({ error, message: 'Error reindexing contacts' });
  }
};
