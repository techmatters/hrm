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
import { IDatabase, QueryParam } from 'pg-promise';

export function createMockConnection<T = unknown>(): pgPromise.ITask<T> {
  return {
    ctx: {
      context: {},
      connected: true,
      inTransaction: false,
      parent: null,
      level: 0,
      useCount: 0,
      isTX: false,
      start: new Date(0),
      tag: {},
      dc: {},
      serverVersion: '',
    },
    none: jest.fn(),
    one: jest.fn(),
    oneOrNone: jest.fn(),
    query: jest.fn(),
    manyOrNone: jest.fn(),
    many: jest.fn(),
    any: jest.fn(),
    multi: jest.fn(),
    multiResult: jest.fn(),
    result: jest.fn(),
    stream: jest.fn(),
    func: jest.fn(),
    proc: jest.fn(),
    map: jest.fn(),
    each: jest.fn(),
    task: jest.fn(),
    taskIf: jest.fn(),
    tx: jest.fn(),
    txIf: jest.fn(),
    batch: jest.fn(),
    page: jest.fn(),
    sequence: jest.fn(),
  };
}

export const mockTask = (db: IDatabase<unknown>, mockConn: pgPromise.ITask<unknown>) => {
  // @ts-ignore
  jest
    .spyOn(db, 'task')
    .mockImplementation(
      (action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
        return action(mockConn);
      },
    );
};
export const mockTransaction = (
  db: IDatabase<unknown>,
  mockConn: pgPromise.ITask<unknown>,
  mockTx: pgPromise.ITask<unknown> | undefined = undefined,
) => {
  if (mockTx) {
    // @ts-ignore
    jest
      .spyOn(mockConn, 'tx')
      .mockImplementation(
        (action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
          return action(mockTx);
        },
      );
    // @ts-ignore
    jest
      .spyOn(mockConn, 'txIf')
      .mockImplementation(
        (action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
          return action(mockTx);
        },
      );
    mockTask(db, mockConn);
  } else {
    // @ts-ignore
    jest
      .spyOn(db, 'tx')
      .mockImplementation(
        (action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
          return action(mockConn);
        },
      );
    // @ts-ignore
    jest
      .spyOn(db, 'txIf')
      .mockImplementation(
        (action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
          return action(mockConn);
        },
      );
  }
};

type PgQuerySpy =
  | jest.SpyInstance<any, [query: QueryParam, values?: any]>
  | jest.SpyInstance<any, [query: QueryParam, values?: any, cb?: any, thisArg?: any]>;

export const getSqlStatement = (mockQueryMethod: PgQuerySpy, callIndex = -1): string => {
  expect(mockQueryMethod).toHaveBeenCalled();
  return mockQueryMethod.mock.calls[
    callIndex < 0 ? mockQueryMethod.mock.calls.length + callIndex : callIndex
  ][0].toString();
};

export const getSqlStatementFromNone = (
  mockQueryMethod: jest.SpyInstance<any, [query: QueryParam, values?: any]>,
  callIndex = -1,
): string => {
  expect(mockQueryMethod).toHaveBeenCalled();
  return mockQueryMethod.mock.calls[
    callIndex < 0 ? mockQueryMethod.mock.calls.length + callIndex : callIndex
  ][0].toString();
};

export const expectValuesInSql = (
  sql: string,
  expectedValues: Record<string, any>,
): void => {
  Object.entries(expectedValues).forEach(([key, val]) => {
    expect(sql).toContain(key);
    if (val && typeof val !== 'function' && typeof val !== 'object') {
      expect(sql).toContain(val.toString());
    }
    if (typeof val === 'object') {
      if (val instanceof Date) {
        expect(sql).toContain(val.toISOString());
      }
    }
  });
};
