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
import { assertExhaustive } from './assertExhaustive';

type ResultBase = {
  readonly _tag: 'Result';
};

export enum ErrorResultKind {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  MethodNotAllowedError,
  InternalServerError,
  NotImplementedError,
}

const errorKindntoHTTPStatusCode = (kind: ErrorResultKind): number => {
  switch (kind) {
    case ErrorResultKind.BadRequestError: {
      return 400;
    }
    case ErrorResultKind.UnauthorizedError: {
      return 401;
    }
    case ErrorResultKind.ForbiddenError: {
      return 403;
    }
    case ErrorResultKind.NotFoundError: {
      return 404;
    }
    case ErrorResultKind.MethodNotAllowedError: {
      return 405;
    }
    case ErrorResultKind.InternalServerError: {
      return 500;
    }
    case ErrorResultKind.NotImplementedError: {
      return 501;
    }
    default: {
      assertExhaustive(kind);
      return 500; // return 500 to make TS happy, but above line should never allow this
    }
  }
};

type NewErrorResultParams = {
  message: string;
  kind: ErrorResultKind;
};

type ErrorResult = ResultBase & {
  status: 'error';
  message: string;
  kind: ErrorResultKind;
  readonly unwrap: () => never;
  readonly intoHTTPError: () => ReturnType<typeof createError>;
};

export const newErr = ({ message, kind }: NewErrorResultParams): ErrorResult => ({
  _tag: 'Result',
  status: 'error',
  message,
  kind,
  unwrap: () => {
    throw new Error(
      `TResult Error: Attempted to unwrap Err variant with message: ${message}`,
    );
  },
  intoHTTPError: () => createError(errorKindntoHTTPStatusCode(kind), message),
});

type SuccessResult<TData> = ResultBase & {
  status: 'success';
  data: TData;
  statusCode: number;
  readonly unwrap: () => TData;
};

type NewSuccessResultParms<TData> = {
  data: TData;
  statusCode?: number;
};

export const newOk = <TData>({
  data,
  statusCode = 200,
}: NewSuccessResultParms<TData>): SuccessResult<TData> => ({
  _tag: 'Result',
  status: 'success',
  data,
  statusCode,
  unwrap: () => data,
});

export type TResult<TData> = SuccessResult<TData> | ErrorResult;

const isResult = (r: unknown): r is TResult<any> => (r as any)?._tag === 'Result';

export const isErr = (result: TResult<any>): result is ErrorResult =>
  isResult(result) && result.status === 'error';

export const isOk = <TData>(result: TResult<TData>): result is SuccessResult<TData> =>
  isResult(result) && result.status === 'success';
