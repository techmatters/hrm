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
import { ITask } from 'pg-promise';
import { db } from './connection-pool';

export const OrderByDirection = {
  ascendingNullsLast: 'ASC NULLS LAST',
  descendingNullsLast: 'DESC NULLS LAST',
  ascending: 'ASC',
  descending: 'DESC',
} as const;

export class DatabaseError extends Error {
  cause: Error;

  constructor(error: Error) {
    super(error.message);
    this.cause = error;
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class DatabaseConstraintViolationError extends DatabaseError {
  table: string;

  constraint: string;

  constructor(error, table, constraint) {
    super(error);
    this.name = 'DatabaseConstraintViolationError';
    Object.setPrototypeOf(this, DatabaseConstraintViolationError.prototype);
    this.table = table;
    this.constraint = constraint;
  }
}

export class DatabaseForeignKeyViolationError extends DatabaseConstraintViolationError {
  constructor(message, table, constraint) {
    super(message, table, constraint);
    this.name = 'DatabaseForeignKeyViolationError';
    Object.setPrototypeOf(this, DatabaseForeignKeyViolationError.prototype);
  }
}

export class DatabaseUniqueConstraintViolationError extends DatabaseConstraintViolationError {
  constructor(error, table, constraint) {
    super(error, table, constraint);
    this.name = 'DatabaseUniqueConstraintViolationError';
    Object.setPrototypeOf(this, DatabaseUniqueConstraintViolationError.prototype);
  }
}

export const inferPostgresError = (rawError: Error): DatabaseError => {
  const errorBlob = rawError as any;
  switch (errorBlob.code) {
    case '23503':
      return new DatabaseForeignKeyViolationError(
        rawError,
        errorBlob.table,
        errorBlob.constraint,
      );
    case '23505':
      return new DatabaseUniqueConstraintViolationError(
        rawError,
        errorBlob.table,
        errorBlob.constraint,
      );
    default:
      return new DatabaseError(rawError);
  }
};

export const txIfNotInOne = async <T>(
  task: ITask<T> | undefined,
  work: (y: ITask<T>) => Promise<T>,
): Promise<T> => {
  if (task) {
    return task.txIf(work);
  }
  return db.tx(work);
};
