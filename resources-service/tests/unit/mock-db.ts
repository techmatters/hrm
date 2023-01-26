import * as pgPromise from 'pg-promise';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as pgMocking from '@tech-matters/testing';
import { db } from '../../src/connection-pool';

jest.mock('../../src/connection-pool', () => ({
  db: pgMocking.createMockConnection(),
  pgp: jest.requireActual('../../src/connection-pool').pgp,
}));

export const mockConnection = pgMocking.createMockConnection;

export const mockTask = (mockConn: pgPromise.ITask<unknown>) => {
  pgMocking.mockTask(db, mockConn);
};
export const mockTransaction = (
  mockConn: pgPromise.ITask<unknown>,
  mockTx: pgPromise.ITask<unknown> | undefined = undefined,
) => {
  return pgMocking.mockTransaction(db, mockConn, mockTx);
};
