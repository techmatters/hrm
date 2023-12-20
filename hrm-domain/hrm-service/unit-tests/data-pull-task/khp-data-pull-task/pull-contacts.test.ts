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

import parseISO from 'date-fns/parseISO';
import formatISO from 'date-fns/formatISO';
import format from 'date-fns/format';
import addDays from 'date-fns/addDays';

import * as contactApi from '../../../src/contact/contactService';
import * as context from '../../../src/data-pull-task/khp-data-pull-task/context';
import { defaultLimitAndOffset } from '../../../src/data-pull-task/khp-data-pull-task/auto-paginate';
import { pullContacts } from '../../../src/data-pull-task/khp-data-pull-task/pull-contacts';

const { maxPermissions } = context;

const accountSid = 'ACxxx';
const bucket = 'docs-bucket';

jest.mock('../../../src/contact/contactService');
jest.mock('../../../src/data-pull-task/khp-data-pull-task/context');

let putS3ObjectSpy = jest.fn();
jest.mock('@tech-matters/s3-client', () => {
  return {
    putS3Object: (params: any) => {
      putS3ObjectSpy(params);
      return Promise.resolve();
    },
  };
});

const getExpectedS3Params = (contact: contactApi.Contact) => {
  const date = format(contact.updatedAt!, 'yyyy/MM/dd');
  return {
    bucket,
    key: `hrm-data/${date}/contacts/${contact.id}.json`,
    body: JSON.stringify(contact),
  };
};

beforeEach(() => {
  const getContextResponse = Promise.resolve({
    accountSid,
    bucket,
  });

  jest.spyOn(context, 'getContext').mockReturnValue(getContextResponse);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('KHP Data Pull - Pull Contacts', () => {
  const startDate = parseISO('2023-05-01T00:00:00.000Z');
  const endDate = parseISO('2023-05-30T00:00:00.000Z');

  const searchParams = {
    dateFrom: formatISO(startDate),
    dateTo: formatISO(endDate),
    onlyDataContacts: false,
    shouldIncludeUpdatedAt: true,
  };

  test('should call searchContacts with the correct params', async () => {
    const searchContactsResponse = Promise.resolve({
      count: 0,
      contacts: [],
    });

    const searchContactsSpy = jest
      .spyOn(contactApi, 'searchContacts')
      .mockReturnValue(searchContactsResponse);

    await pullContacts(startDate, endDate);

    expect(searchContactsSpy).toHaveBeenCalledWith(
      accountSid,
      searchParams,
      defaultLimitAndOffset,
      maxPermissions,
      true,
    );
  });

  test('should call upload to S3 with the correct params', async () => {
    const contact1 = {
      id: 1234,
      createdAt: addDays(startDate, 1),
      updatedAt: addDays(startDate, 1),
      accountSid,
      csamReports: [],
    };

    const contact2 = {
      id: 2345,
      createdAt: addDays(startDate, 2),
      updatedAt: addDays(startDate, 2),
      accountSid,
      csamReports: [],
    };

    const searchContactsResponse = Promise.resolve({
      count: 2,
      contacts: [contact1, contact2],
    });

    jest.spyOn(contactApi, 'searchContacts').mockReturnValue(searchContactsResponse);

    await pullContacts(startDate, endDate);

    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(contact1));
    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(contact2));

    expect(putS3ObjectSpy).toBeCalledTimes(2);
  });
});
