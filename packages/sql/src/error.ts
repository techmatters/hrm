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

  constructor(error: Error, table: string, constraint: string) {
    super(error);
    this.name = 'DatabaseConstraintViolationError';
    Object.setPrototypeOf(this, DatabaseConstraintViolationError.prototype);
    this.table = table;
    this.constraint = constraint;
  }
}

export class DatabaseForeignKeyViolationError extends DatabaseConstraintViolationError {
  constructor(error: string | Error, table: string, constraint: string) {
    super(typeof error === 'string' ? Error(error) : error, table, constraint);
    this.name = 'DatabaseForeignKeyViolationError';
    Object.setPrototypeOf(this, DatabaseForeignKeyViolationError.prototype);
  }
}

export class DatabaseUniqueConstraintViolationError extends DatabaseConstraintViolationError {
  constructor(error: Error, table: string, constraint: string) {
    super(error, table, constraint);
    this.name = 'DatabaseUniqueConstraintViolationError';
    Object.setPrototypeOf(this, DatabaseUniqueConstraintViolationError.prototype);
  }
}

export const inferPostgresError = (rawError: Error): DatabaseError => {
  const errorBlob = rawError as any;
  switch (errorBlob.code) {
    case '23503':
      return new DatabaseForeignKeyViolationError(rawError, errorBlob.table, errorBlob.constraint);
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
