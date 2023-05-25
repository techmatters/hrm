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

import { getContext, noLimitsOrOffset, maxPermissions } from './context';
import { Contact } from '../../contact/contact-data-access';
import * as contactApi from '../../contact/contact';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  dateFrom: formatISO(startDate),
  dateTo: formatISO(endDate),
  onlyDataContacts: false,
});

export const pullContacts = async (startDate: Date, endDate: Date) => {
  const { s3Client, accountSid, bucketName } = await getContext();

  const searchParams = getSearchParams(startDate, endDate);
  const originalFormat = true;
  const searchContactsResult = await contactApi.searchContacts(
    accountSid,
    searchParams,
    noLimitsOrOffset,
    maxPermissions,
    originalFormat,
  );

  // Here we can safely cast to Contact[] because we're passing originalFormat: true
  const { contacts } = <{ contacts: Contact[] }>searchContactsResult;

  const Bucket = bucketName;
  const uploadPromises = contacts.map(contact => {
    /*
      Contact type is slightly wrong. The instance object actually has:
      1) 'totalCount' property, which I think is wrong, so I'm deleting it
    */
    delete (contact as any).totalCount;
    const date = format(contact.updatedAt, 'yyyy/MM/dd');
    const Key = `hrm-data/${date}/contacts/${contact.id}.json`;
    const Body = JSON.stringify(contact);
    const params = { Bucket, Key, Body };

    return s3Client.upload(params).promise();
  });

  try {
    await Promise.all(uploadPromises);
    console.log('>> KHP Contacts were pulled successfully!');
  } catch {
    console.error('>> Error in KHP Data Pull: Contacts');
    // TODO: Should throw an error?
  }
};
