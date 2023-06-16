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

import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  DatabaseError,
  inferPostgresError,
} from '../../src';

describe('inferPostgresError', () => {
  test('Error with code property set to 23503 - creates DatabaseKeyViolationError, wrapping original and copying table and constraint properties', () => {
    const originalError: any = new Error();
    originalError.code = '23503';
    originalError.table = 'a table';
    originalError.constraint = 'a constraint';
    const inferredError = inferPostgresError(originalError);
    expect(inferredError).toBeInstanceOf(DatabaseForeignKeyViolationError);
    expect(inferredError.cause).toBe(originalError);
    const fkError: DatabaseForeignKeyViolationError = inferredError as DatabaseForeignKeyViolationError;
    expect(fkError.table).toBe(originalError.table);
    expect(fkError.constraint).toBe(originalError.constraint);
  });
  test('Error with code property set to 23505 - creates DatabaseUniqueConstraintViolationError, wrapping original and copying table and constraint properties', () => {
    const originalError: any = new Error();
    originalError.code = '23505';
    originalError.table = 'a table';
    originalError.constraint = 'a constraint';
    const inferredError = inferPostgresError(originalError);
    expect(inferredError).toBeInstanceOf(DatabaseUniqueConstraintViolationError);
    expect(inferredError.cause).toBe(originalError);
    const fkError: DatabaseForeignKeyViolationError = inferredError as DatabaseUniqueConstraintViolationError;
    expect(fkError.table).toBe(originalError.table);
    expect(fkError.constraint).toBe(originalError.constraint);
  });

  test('Error with sny other code - wraps original error in DatabaseError', () => {
    const originalError: any = new Error();
    originalError.code = 'something else';
    originalError.table = 'a table';
    originalError.constraint = 'a constraint';
    const inferredError = inferPostgresError(originalError);
    expect(inferredError).toBeInstanceOf(DatabaseError);
    expect(inferredError.cause).toBe(originalError);
  });
});
