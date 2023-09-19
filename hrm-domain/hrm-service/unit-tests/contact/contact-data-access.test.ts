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

import * as pgPromise from 'pg-promise';
import { mockConnection, mockTask, mockTransaction } from '../mock-db';
import { search, create } from '../../src/contact/contact-data-access';
import { ContactBuilder } from './contact-builder';
import {
  NewContactRecord,
  insertContactSql,
} from '../../src/contact/sql/contact-insert-sql';

jest.mock('../../src/contact/sql/contact-insert-sql', () => ({
  insertContactSql: jest.fn().mockReturnValue('MOCKED INSERT STATEMENT'),
}));

let conn: pgPromise.ITask<unknown>;

beforeEach(() => {
  conn = mockConnection();
});

describe('create', () => {
  const sampleNewContact: NewContactRecord = {
    rawJson: {
      childInformation: {
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      callType: 'carrier pigeon',
      caseInformation: {
        categories: {},
      },
    },
    queueName: 'Q',
    conversationDuration: 100,
    twilioWorkerId: undefined,
    timeOfContact: undefined,
    createdBy: undefined,
    helpline: undefined,
    taskId: undefined,
    channel: undefined,
    number: undefined,
    channelSid: undefined,
    serviceSid: undefined,
  };

  test('No task ID specified in payload - runs SQL to insert new record and connect CSAM reports, using current date for created / updated and accountSid parameter', async () => {
    const returnValue = new ContactBuilder().build();
    mockTransaction(conn);

    jest.spyOn(conn, 'one').mockResolvedValue(returnValue);

    const created = await create()('parameter account-sid', sampleNewContact);
    expect(insertContactSql).toHaveBeenCalledWith({
      ...sampleNewContact,
      updatedAt: expect.anything(),
      createdAt: expect.anything(),
      accountSid: 'parameter account-sid',
    });
    expect(conn.one).toHaveBeenCalledWith(
      expect.stringContaining('MOCKED INSERT STATEMENT'),
    );
    expect(created).toStrictEqual({
      contact: returnValue,
      isNewRecord: true,
    });
  });

  test('Task ID specified in payload that is not already associated with a contact - creates contact as expected', async () => {
    const returnValue = new ContactBuilder().build();
    const sampleContactWithTaskId = { ...sampleNewContact, taskId: 'A TASK' };
    mockTransaction(conn);

    jest.spyOn(conn, 'one').mockResolvedValue(returnValue);

    const created = await create()('parameter account-sid', sampleContactWithTaskId);
    expect(insertContactSql).toHaveBeenCalledWith({
      ...sampleContactWithTaskId,
      updatedAt: expect.anything(),
      createdAt: expect.anything(),
      accountSid: 'parameter account-sid',
    });
    expect(conn.one).toHaveBeenCalledWith(
      expect.stringContaining('MOCKED INSERT STATEMENT'),
    );
    expect(created).toStrictEqual({
      contact: returnValue,
      isNewRecord: true,
    });
  });
});

describe('search', () => {
  const ACCOUNT_SID = 'search-account-sid';

  const emptySearch = {
    helpline: undefined,
    lastNamePattern: undefined,
    firstNamePattern: undefined,
    phoneNumberPattern: undefined,
    counselor: undefined,
    contactNumber: undefined,
    accountSid: ACCOUNT_SID,
    dateFrom: undefined,
    dateTo: undefined,
    onlyDataContacts: false,
    shouldIncludeUpdatedAt: false,
    dataCallTypes: expect.arrayContaining([
      'Someone calling about a child',
      'Child calling about self',
    ]),
  };

  test('No parameters - searches with accountSid offset and limit only', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(ACCOUNT_SID, { onlyDataContacts: false }, 42, 1337);
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      limit: 42,
      offset: 1337,
    });
  });

  test('dateTo / dateFrom parameters - converts them to UTC', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(
      ACCOUNT_SID,
      {
        onlyDataContacts: false,
        dateFrom: '2000-05-15T17:00:00+05:00',
        dateTo: '2000-05-25T08:00:00-04:00',
      },
      42,
      1337,
    );
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      dateFrom: new Date('2000-05-15T12:00:00Z').toISOString(),
      dateTo: new Date('2000-05-25T12:00:00Z').toISOString(),
      limit: 42,
      offset: 1337,
    });
  });

  test('name parameters - converts them to ILIKE patterns', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(
      ACCOUNT_SID,
      {
        onlyDataContacts: false,
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      1000,
      0,
    );
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      firstNamePattern: '%Lorna%',
      lastNamePattern: '%Ballantyne%',
      limit: 1000,
      offset: 0,
    });
  });

  test('phone number parameter - removes non numeric characters & converts it to ILIKE patterns', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(
      ACCOUNT_SID,
      {
        onlyDataContacts: false,
        phoneNumber: "1 o'clock, 2 o'clock, 3'clock, ROCK!",
      },
      1000,
      0,
    );
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      phoneNumberPattern: '%123%',
      limit: 1000,
      offset: 0,
    });
  });

  test('other parameters - copies them over as is', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(
      ACCOUNT_SID,
      {
        onlyDataContacts: true,
        contactNumber: "1 o'clock, 2 o'clock, 3'clock, ROCK!",
        counselor: 'contact-owner',
        helpline: 'a helpline',
      },
      1000,
      0,
    );
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      onlyDataContacts: true,
      contactNumber: "1 o'clock, 2 o'clock, 3'clock, ROCK!",
      counselor: 'contact-owner',
      helpline: 'a helpline',
      limit: 1000,
      offset: 0,
    });
  });
  test('other parameters - set as undefined if empty strings', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    await search(
      ACCOUNT_SID,
      {
        onlyDataContacts: true,
        contactNumber: '',
        counselor: '',
        helpline: '',
      },
      1000,
      0,
    );
    expect(conn.manyOrNone).toHaveBeenCalledWith(expect.any(String), {
      ...emptySearch,
      onlyDataContacts: true,
      contactNumber: undefined,
      counselor: undefined,
      helpline: undefined,
      limit: 1000,
      offset: 0,
    });
  });

  test('Empty results - returns empty row array and count of 0', async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([]);
    mockTask(conn);
    const result = await search(ACCOUNT_SID, { onlyDataContacts: false }, 42, 1337);
    expect(result.count).toBe(0);
    expect(result.rows).toStrictEqual([]);
  });

  test("Populated results - returns contact row array and count taken from the 'totalCount' field on the first record.", async () => {
    jest.spyOn(conn, 'manyOrNone').mockResolvedValue([
      { id: 1234, totalCount: 1337 },
      { id: 4321, totalCount: 1337 },
    ]);
    mockTask(conn);
    const result = await search(ACCOUNT_SID, { onlyDataContacts: false }, 10, 0);
    expect(result.count).toBe(1337);
    expect(result.rows).toStrictEqual([
      { id: 1234, totalCount: 1337 },
      { id: 4321, totalCount: 1337 },
    ]);
  });
});
