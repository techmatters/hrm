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
import * as caseApi from '../../case/case';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  filters: {
    // TODO: should use updatedAt instead?
    createdAt: {
      from: formatISO(startDate),
      to: formatISO(endDate),
    },
  },
});

export const pullCases = async (startDate: Date, endDate: Date) => {
  const { s3Client, accountSid, bucketName } = await getContext();

  const searchParams = getSearchParams(startDate, endDate);

  const searchCasesResult = await caseApi.searchCases(
    accountSid,
    noLimitsOrOffset,
    searchParams,
    maxPermissions,
  );

  const { cases } = searchCasesResult;

  const mapContactsToId = (contacts: Required<{ id: number }>[]) =>
    contacts.map(contact => contact.id);

  const casesWithContactIdOnly = cases.map(cas => ({
    ...cas,
    connectedContacts: mapContactsToId(cas.connectedContacts),
  }));

  const Bucket = bucketName;
  const uploadPromises = casesWithContactIdOnly.map(cas => {
    /*
      Case type is slightly wrong. The instance object actually has:
      1) 'totalCount' property, which I think is wrong, so I'm deleting it
      2) 'createdAt' property is actually a Date instead of a string, so I'm explicitaly converting it to Date
    */
    delete (cas as any).totalCount;
    const date = format((cas.createdAt as unknown) as Date, 'yyyy/MM/dd');
    const Key = `hrm-data/${date}/cases/${cas.id}.json`;
    const Body = JSON.stringify(cas);
    const params = { Bucket, Key, Body };

    return s3Client.upload(params).promise();
  });

  try {
    await Promise.all(uploadPromises);
    console.log('>> KHP Cases were pulled successfully!');
  } catch {
    console.error('>> Error in KHP Data Pull: Cases');
    // TODO: Should throw an error?
  }
};
