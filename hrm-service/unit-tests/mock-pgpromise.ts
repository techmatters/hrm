import * as pgPromise from 'pg-promise';
import { db } from '../src/connection-pool';
import { QueryParam } from 'pg-promise';

function createMockConnection() {
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

jest.mock('../src/connection-pool', ()=> ({
  db: createMockConnection(),
  pgp: jest.requireActual('../src/connection-pool').pgp,
}));

export const mockConnection = createMockConnection;

export const mockTask = (mockConn: pgPromise.ITask<unknown>) => {
  // @ts-ignore
  jest.spyOn(db, 'task').mockImplementation((action: (connection: pgPromise.ITask<unknown>)=>Promise<any>)=> {
    return action(mockConn);
  });
};
export const mockTransaction = (mockConn: pgPromise.ITask<unknown>, mockTx: pgPromise.ITask<unknown> | undefined = undefined) => {
  if (mockTx) {
    // @ts-ignore
    jest.spyOn(mockConn, 'tx').mockImplementation((action: (connection: pgPromise.ITask<unknown>) => Promise<any>) => {
      return action(mockTx);
    });

    mockTask(mockConn);
  } else {
    // @ts-ignore
    jest.spyOn(db, 'tx').mockImplementation((action: (connection: pgPromise.ITask<unknown>)=>Promise<any>)=> {
      return action(mockConn);
    });
  }
};

// eslint-disable-next-line prettier/prettier
type PgQueryParameters = [query: QueryParam, values?:any] | [query: QueryParam, values?:any, cb?: any, thisArg?: any];

export const getSqlStatement = (mockQueryMethod: jest.SpyInstance<any, PgQueryParameters>, callIndex = -1): string => {
  expect(mockQueryMethod).toHaveBeenCalled();
  return mockQueryMethod.mock.calls[callIndex < 0 ? mockQueryMethod.mock.calls.length + callIndex : callIndex][0].toString();
};

export const expectValuesInSql = (sql: string,  expectedValues: Record<string, any>): void => {
  Object.entries(expectedValues).forEach(([key, val] )=> {
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