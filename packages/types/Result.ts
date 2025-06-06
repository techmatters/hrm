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
import createError from 'http-errors';

type ResultBase = {
  readonly _tag: 'Result';
};

type NewErrorResultParams<TError> = {
  message: string;
  error: TError;
  extraProperties?: Record<string, any>;
};

export type ErrorResult<TError> = ResultBase & {
  status: 'error';
  message: string;
  error: TError;
  readonly unwrap: () => never;
};

export const mapHTTPError = <TError extends string>(
  err: ErrorResult<TError>,
  mapper: { [E in TError]: number },
): ReturnType<typeof createError> => {
  return createError(mapper[err.error], err.message);
};

class ResultError<T extends ErrorResult<any>> extends Error {
  errorResult: T;

  constructor(public result: T) {
    super(result.message);
    this.errorResult = result;
  }
}

export const newErr = <TError>({
  message,
  error,
}: NewErrorResultParams<TError>): ErrorResult<TError> => {
  return {
    _tag: 'Result',
    status: 'error',
    message,
    error,
    unwrap: function (this: ErrorResult<TError>) {
      throw new ResultError(this);
    },
  };
};

type AsyncResultTypeFunction<TError extends ErrorResult<any>, TData> = (
  ...p: any[]
) => Promise<Result<TError, TData>>;

type AsyncResultTypeFunctionWrapper<TError extends ErrorResult<any>, TData> = (
  workFunc: AsyncResultTypeFunction<TError, TData>,
) => Promise<Result<TError, TData>>;

/**
 * Wraps a function that takes an async worker function to execute.
 * When said function is given a Result<> returning function, it will detect ErrorResults and throw them in the context of the executing function we are wrapping
 * Then it will catch the error once it bubbles through the executing function, rewrap it as an ErrorResult and return it.
 * This is primarily useful for pg promise functions, where automatic transaction management is based around promise resolution / rejection.
 * You can use this function to wrap the pg-promise function so that it sees the error result or the worker as a rejection and rolls back accordingly, but your own code can still use the ErrorResult
 * e.g.:
 * ```typescript
 * const TResult<'QUERY_FAILED', string>ensureRejection(tx.one(conn => {
 *   try {
 *     await conn.query('SELECT * FROM table');
 *     return newOkFromData('success');
 *   } catch (err) {
 *     return newErr({ message: 'Failed to query', error: 'QUERY_FAILED' });
 *   }
 * });
 * ```
 * The above function will pass a rejection to the pg-promise transaction manager if the query fails, but will still return an ErrorResult to the caller.
 * @throws ResultError
 */
export const ensureRejection = <TError extends ErrorResult<any>, TData>(
  inputWrapper: AsyncResultTypeFunctionWrapper<TError, TData>,
): AsyncResultTypeFunctionWrapper<TError, TData> => {
  return async (workFunc: AsyncResultTypeFunction<TError, TData>) => {
    try {
      let errorUnwrapper: typeof workFunc = async (...p: Parameters<typeof workFunc>) => {
        const initialWorkResult = await workFunc(...p);
        initialWorkResult.unwrap(); // Will throw an error if it's an error result
        return initialWorkResult;
      };
      return await inputWrapper(errorUnwrapper);
    } catch (e) {
      if (e instanceof ResultError) {
        return e.errorResult;
      }
      throw e;
    }
  };
};

export type SuccessResult<TData> = ResultBase & {
  status: 'success';
  data: TData;
  readonly unwrap: () => TData;
};

type NewSuccessResultParms<TData> = {
  data: TData;
  statusCode?: number;
};

export const newOk = <TData>({
  data,
}: NewSuccessResultParms<TData>): SuccessResult<TData> => ({
  _tag: 'Result',
  status: 'success',
  data,
  unwrap: () => data,
});

export const newOkFromData = <TData>(data: TData) => newOk({ data });

export type Result<TErrorResult extends ErrorResult<string>, TData> =
  | TErrorResult
  | SuccessResult<TData>;

export type TResult<TError extends string, TData> = Result<ErrorResult<TError>, TData>;

const isResult = (r: unknown): r is TResult<any, any> => (r as any)?._tag === 'Result';

export const isErr = <TError extends ErrorResult<any>>(
  result: Result<ErrorResult<any>, any>,
): result is TError => isResult(result) && result.status === 'error';

export const isOk = <TData>(
  result: TResult<any, TData>,
): result is SuccessResult<TData> => isResult(result) && result.status === 'success';
