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
import { subHours } from 'date-fns';
import { mockConnection, mockTransaction } from '../mock-db';
import * as referralDb from '../../src/referral/referral-data-access';
import {
  DuplicateReferralError,
  OrphanedReferralError,
} from '../../src/referral/referral-data-access';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  DatabaseError,
} from '../../src/sql';
import { getSqlStatement } from '@tech-matters/testing';

let conn: pgPromise.ITask<unknown>;

beforeEach(() => {
  conn = mockConnection();
});

describe('createReferralRecord', () => {
  const hourAgo = subHours(new Date(), 1);
  const validReferral = {
    contactId: '1234',
    resourceId: 'TEST_RESOURCE',
    referredAt: hourAgo.toISOString(),
    resourceName: 'A test referred resource',
  };

  test('Runs a INSERT against the Referrals table on the DB', async () => {
    mockTransaction(conn);
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(validReferral);

    const result = await referralDb.createReferralRecord()('AC_FAKE', validReferral);
    const insertSql = getSqlStatement(oneSpy);
    expect(insertSql).toContain('Referrals');
    expect(insertSql).toContain(validReferral.resourceId);
    expect(insertSql).toContain(validReferral.referredAt);
    expect(insertSql).toContain(validReferral.contactId);
    expect(insertSql).toContain(validReferral.resourceName);
    expect(insertSql).toContain('AC_FAKE');
    expect(result).toStrictEqual(validReferral);
  });

  test('Inserts explicit NULL for resourceName if not provided', async () => {
    mockTransaction(conn);

    const { resourceName, ...withoutResourceName } = validReferral;
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(withoutResourceName);

    const result = await referralDb.createReferralRecord()('AC_FAKE', withoutResourceName);

    expect(oneSpy).toHaveBeenCalledWith(expect.stringContaining('Referrals'));
    const insertSql = oneSpy.mock.calls[0][0];
    expect(insertSql).toContain(validReferral.resourceId);
    expect(insertSql).toContain(validReferral.referredAt);
    expect(insertSql).toContain(validReferral.contactId);
    expect(insertSql).toContain('null');
    expect(insertSql).toContain('AC_FAKE');
    expect(result).toStrictEqual(withoutResourceName);
  });

  test('Query throws a foreign key violation against contact ID constraint - throws an OrphanedReferralError', async () => {
    mockTransaction(conn);
    const dbError: any = new Error();
    dbError.code = '23503';
    dbError.constraint = 'FK_Referrals_Contacts';
    dbError.table = 'Referrals';
    jest.spyOn(conn, 'one').mockRejectedValue(dbError);

    await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(
      OrphanedReferralError,
    );
  });

  test('Query throws a foreign key violation against other constraint - throws an DatabaseForeignKeyViolationError', async () => {
    mockTransaction(conn);
    const dbError: any = new Error();
    dbError.code = '23503';
    dbError.constraint = 'Other_Constraint';
    dbError.table = 'Referrals';
    jest.spyOn(conn, 'one').mockRejectedValue(dbError);

    await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(
      DatabaseForeignKeyViolationError,
    );
  });

  test('Query throws a unique constraint violation against primary key constraint - throws an DuplicateReferralError', async () => {
    mockTransaction(conn);
    const dbError: any = new Error();
    dbError.code = '23505';
    dbError.constraint = 'Referrals_pkey';
    dbError.table = 'Referrals';
    jest.spyOn(conn, 'one').mockRejectedValue(dbError);

    await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(
      DuplicateReferralError,
    );
  });

  test('Query throws a foreign key violation against other constraint - throws an DatabaseForeignKeyViolationError', async () => {
    mockTransaction(conn);
    const dbError: any = new Error();
    dbError.code = '23505';
    dbError.constraint = 'Other_Constraint';
    dbError.table = 'Referrals';
    jest.spyOn(conn, 'one').mockRejectedValue(dbError);

    await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(
      DatabaseUniqueConstraintViolationError,
    );
  });

  test('Query throws any other error - throws an DatabaseError wrapping the original', async () => {
    mockTransaction(conn);
    const originalError: any = new Error();
    originalError.code = 'OTHER_CODE';
    jest.spyOn(conn, 'one').mockRejectedValue(originalError);

    await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(
      new DatabaseError(originalError),
    );
  });

  test('Passed a task - uses task', async () => {
    const mockTx = mockConnection();
    const mockOuterTask = mockConnection();
    mockTransaction(conn);
    mockTransaction(mockOuterTask, mockTx);

    const txOneSpy = jest.spyOn(mockTx, 'one').mockResolvedValue(validReferral);
    const dbOneSpy = jest.spyOn(conn, 'one').mockResolvedValue(validReferral);

    await referralDb.createReferralRecord(mockOuterTask)('AC_FAKE', validReferral);
    expect(dbOneSpy).not.toHaveBeenCalled();
    const insertSql = getSqlStatement(txOneSpy);
    expect(insertSql).toContain('Referrals');
  });
});
