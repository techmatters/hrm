"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.txIfNotInOne = exports.inferPostgresError = exports.DatabaseUniqueConstraintViolationError = exports.DatabaseForeignKeyViolationError = exports.DatabaseConstraintViolationError = exports.DatabaseError = exports.inferPostgresErrorResult = exports.isDatabaseUniqueConstraintViolationErrorResult = exports.isDatabaseForeignKeyViolationErrorResult = exports.OrderByDirection = void 0;
const types_1 = require("@tech-matters/types");
exports.OrderByDirection = {
    ascendingNullsLast: 'ASC NULLS LAST',
    descendingNullsLast: 'DESC NULLS LAST',
    ascending: 'ASC',
    descending: 'DESC',
};
const isDatabaseForeignKeyViolationErrorResult = (errorResult) => errorResult.error === 'DatabaseForeignKeyViolationError';
exports.isDatabaseForeignKeyViolationErrorResult = isDatabaseForeignKeyViolationErrorResult;
const isDatabaseUniqueConstraintViolationErrorResult = (errorResult) => errorResult.error === 'DatabaseUniqueConstraintViolationError';
exports.isDatabaseUniqueConstraintViolationErrorResult = isDatabaseUniqueConstraintViolationErrorResult;
const inferPostgresErrorResult = (rawError) => {
    const errorBlob = rawError;
    switch (errorBlob.code) {
        case '23503':
            return {
                ...(0, types_1.newErr)({
                    message: rawError.message,
                    error: 'DatabaseForeignKeyViolationError',
                }),
                rawError,
                table: errorBlob.table,
                constraint: errorBlob.constraint,
            };
        case '23505':
            return {
                ...(0, types_1.newErr)({
                    message: rawError.message,
                    error: 'DatabaseUniqueConstraintViolationError',
                }),
                rawError,
                table: errorBlob.table,
                constraint: errorBlob.constraint,
            };
        default:
            return {
                ...(0, types_1.newErr)({ message: rawError.message, error: 'DatabaseError' }),
                rawError,
                message: rawError.message,
            };
    }
};
exports.inferPostgresErrorResult = inferPostgresErrorResult;
class DatabaseError extends Error {
    cause;
    constructor(error) {
        super(error.message);
        this.cause = error;
        this.name = `DatabaseError`;
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}
exports.DatabaseError = DatabaseError;
class DatabaseConstraintViolationError extends DatabaseError {
    table;
    constraint;
    constructor(error, table, constraint) {
        super(error);
        this.name = 'DatabaseConstraintViolationError';
        Object.setPrototypeOf(this, DatabaseConstraintViolationError.prototype);
        this.table = table;
        this.constraint = constraint;
    }
}
exports.DatabaseConstraintViolationError = DatabaseConstraintViolationError;
class DatabaseForeignKeyViolationError extends DatabaseConstraintViolationError {
    constructor(message, table, constraint) {
        super(message, table, constraint);
        this.name = 'DatabaseForeignKeyViolationError';
        Object.setPrototypeOf(this, DatabaseForeignKeyViolationError.prototype);
    }
}
exports.DatabaseForeignKeyViolationError = DatabaseForeignKeyViolationError;
class DatabaseUniqueConstraintViolationError extends DatabaseConstraintViolationError {
    constructor(error, table, constraint) {
        super(error, table, constraint);
        this.name = 'DatabaseUniqueConstraintViolationError';
        Object.setPrototypeOf(this, DatabaseUniqueConstraintViolationError.prototype);
    }
}
exports.DatabaseUniqueConstraintViolationError = DatabaseUniqueConstraintViolationError;
const inferPostgresError = (rawError) => {
    const errorBlob = rawError;
    switch (errorBlob.code) {
        case '23503':
            return new DatabaseForeignKeyViolationError(rawError, errorBlob.table, errorBlob.constraint);
        case '23505':
            return new DatabaseUniqueConstraintViolationError(rawError, errorBlob.table, errorBlob.constraint);
        default:
            return new DatabaseError(rawError);
    }
};
exports.inferPostgresError = inferPostgresError;
const txIfNotInOne = async (db, task, work) => {
    if (task) {
        return task.txIf(work);
    }
    return db.tx(work);
};
exports.txIfNotInOne = txIfNotInOne;
