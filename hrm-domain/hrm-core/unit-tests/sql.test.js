"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const sql_1 = require("../sql");
describe('inferPostgresError', () => {
    test('Error with code property set to 23503 - creates DatabaseKeyViolationError, wrapping original and copying table and constraint properties', () => {
        const originalError = new Error();
        originalError.code = '23503';
        originalError.table = 'a table';
        originalError.constraint = 'a constraint';
        const inferredError = (0, sql_1.inferPostgresError)(originalError);
        expect(inferredError).toBeInstanceOf(sql_1.DatabaseForeignKeyViolationError);
        expect(inferredError.cause).toBe(originalError);
        const fkError = inferredError;
        expect(fkError.table).toBe(originalError.table);
        expect(fkError.constraint).toBe(originalError.constraint);
    });
    test('Error with code property set to 23505 - creates DatabaseUniqueConstraintViolationError, wrapping original and copying table and constraint properties', () => {
        const originalError = new Error();
        originalError.code = '23505';
        originalError.table = 'a table';
        originalError.constraint = 'a constraint';
        const inferredError = (0, sql_1.inferPostgresError)(originalError);
        expect(inferredError).toBeInstanceOf(sql_1.DatabaseUniqueConstraintViolationError);
        expect(inferredError.cause).toBe(originalError);
        const fkError = inferredError;
        expect(fkError.table).toBe(originalError.table);
        expect(fkError.constraint).toBe(originalError.constraint);
    });
    test('Error with sny other code - wraps original error in DatabaseError', () => {
        const originalError = new Error();
        originalError.code = 'something else';
        originalError.table = 'a table';
        originalError.constraint = 'a constraint';
        const inferredError = (0, sql_1.inferPostgresError)(originalError);
        expect(inferredError).toBeInstanceOf(sql_1.DatabaseError);
        expect(inferredError.cause).toBe(originalError);
    });
});
