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

import format from 'date-fns/format';
import formatISO from 'date-fns/formatISO';
import { putS3Object } from '@tech-matters/s3-client';

import { getContext, maxPermissions } from './context';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import { autoPaginate } from './auto-paginate';
import { parseISO } from 'date-fns';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  dateFrom: formatISO(startDate),
  dateTo: formatISO(endDate),
  onlyDataContacts: false,
  shouldIncludeUpdatedAt: true,
});

export const pullContacts = async (startDate: Date, endDate: Date) => {
  const { accountSid, bucket, hrmEnv, shortCode } = await getContext();

  const searchParams = getSearchParams(startDate, endDate);

  const contacts = await autoPaginate<contactApi.Contact>(async limitAndOffset => {
    const res = await contactApi.searchContacts(
      accountSid,
      searchParams,
      limitAndOffset,
      maxPermissions,
    );
    return { records: res.contacts, count: res.count };
  });

  const uploadPromises = contacts.map(contact => {
    /*
      Contact type is slightly wrong. The instance object actually has:
      1) 'totalCount' property, which I think is wrong, so I'm deleting it
    */
    delete (contact as any).totalCount;
    const date = format(parseISO(contact.updatedAt ?? contact.createdAt), 'yyyy/MM/dd');
    const key = `hrm-data/${date}/contacts/${contact.id}.json`;
    const body = JSON.stringify(contact);
    const params = { bucket, key, body };

    return putS3Object(params);
  });

  try {
    await Promise.all(uploadPromises);
    console.log(`>> ${shortCode} ${hrmEnv} Contacts were pulled successfully!`);
  } catch (err) {
    console.error(`>> Error in ${shortCode} ${hrmEnv} Data Pull: Contacts`);
    console.error(err);
    // TODO: Should throw an error?
  }
};
