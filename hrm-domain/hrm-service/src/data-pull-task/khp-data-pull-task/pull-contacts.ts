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
import parseISO from 'date-fns/parseISO';

import { getContext, noLimitsOrOffset, maxPermissions } from './context';
import * as contactApi from '../../contact/contact';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  dateFrom: formatISO(startDate),
  dateTo: formatISO(endDate),
  onlyDataContacts: false,
});

export const pullContacts = async (startDate: Date, endDate: Date) => {
  const { s3Client, accountSid, bucketName } = await getContext();

  const searchParams = getSearchParams(startDate, endDate);

  const searchContactsResult = await contactApi.searchContacts(
    accountSid,
    searchParams,
    noLimitsOrOffset,
    maxPermissions,
  );

  const { contacts } = searchContactsResult;

  const Bucket = bucketName;
  const uploadPromises = contacts.map(contact => {
    const date = format(parseISO(contact.overview.dateTime), 'yyyy/MM/dd');
    const Key = `hrm-data/${date}/contacts/${contact.contactId}.json`;
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
