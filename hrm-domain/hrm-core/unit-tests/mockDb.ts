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
// eslint-disable-next-line import/no-extraneous-dependencies
import * as pgMocking from '@tech-matters/testing';
import { db } from '../dbConnection';
import { Database } from '@tech-matters/database-connect';

const userDbs: Record<string, Database> = {};

jest.mock('../dbConnection', () => ({
  db: pgMocking.createMockConnection(),
  getDbForUser: (accountSid: string) => {
    // Might already have been populated by a call to mockTask
    userDbs[accountSid] =
      userDbs[accountSid] ?? (pgMocking.createMockConnection() as any);
    return Promise.resolve(userDbs[accountSid]);
  },
  pgp: jest.requireActual('../dbConnection').pgp,
}));

export const mockConnection = pgMocking.createMockConnection;

export const getMockUserDb = (userKey?: string) => {
  if (!userDbs[userKey]) {
    userDbs[userKey] = pgMocking.createMockConnection() as any;
  }
  return userDbs[userKey];
};

export const mockTask = (mockConn: pgPromise.ITask<unknown>, userKey?: string) => {
  let userDb: Database;
  if (userKey) {
    userDb = getMockUserDb(userKey);
  } else {
    const userDbList = Object.values(userDbs);
    if (userDbList.length === 1) {
      // Most tests will only deal with a single user connect, so if there's only one, use that
      userDb = userDbList[0];
    } else {
      // Assume legacy code
      userDb = db;
    }
  }
  pgMocking.mockTask(userDb, mockConn);
};

export const mockTransaction = (
  mockConn: pgPromise.ITask<unknown>,
  mockTx: pgPromise.ITask<unknown> | undefined = undefined,
) => {
  return pgMocking.mockTransaction(db, mockConn, mockTx);
};
