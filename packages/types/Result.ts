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

type NewErrorResultParams<TError extends string> = {
  message: string;
  error: TError;
};

type ErrorResult<TError> = ResultBase & {
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

export const newErr = <TError extends string>({
  message,
  error,
}: NewErrorResultParams<TError>): ErrorResult<TError> => ({
  _tag: 'Result',
  status: 'error',
  message,
  error,
  unwrap: () => {
    throw new Error(
      `TResult Error: Attempted to unwrap Err variant with message: ${message}`,
    );
  },
});

type SuccessResult<TData> = ResultBase & {
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

export type TResult<TError extends string, TData> =
  | ErrorResult<TError>
  | SuccessResult<TData>;

const isResult = (r: unknown): r is TResult<any, any> => (r as any)?._tag === 'Result';

export const isErr = <TError extends string>(
  result: TResult<TError, any>,
): result is ErrorResult<TError> => isResult(result) && result.status === 'error';

export const isOk = <TData>(
  result: TResult<any, TData>,
): result is SuccessResult<TData> => isResult(result) && result.status === 'success';
