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

type ResultBase = {
  _tag: 'Resource';
};

type NewErrorResultParams = {
  message: string;
  statusCode?: number;
  name?: string;
};

type ErrorResult = ResultBase & {
  status: 'error';
  message: string;
  statusCode: number;
  name: string;
};

const err = ({
  message,
  statusCode = 500,
  name = 'Error',
}: NewErrorResultParams): ErrorResult => ({
  _tag: 'Resource',
  status: 'error',
  message,
  statusCode,
  name,
});

type SuccessResult<TData> = ResultBase & {
  status: 'success';
  data: TData;
  statusCode: number;
};

type NewSuccessResultParms<TData> = {
  data: TData;
  statusCode?: number;
};

const ok = <TData>({
  data,
  statusCode = 200,
}: NewSuccessResultParms<TData>): SuccessResult<TData> => ({
  _tag: 'Resource',
  status: 'success',
  data,
  statusCode,
});

type TResult<TData> = SuccessResult<TData> | ErrorResult;

const isResult = (r: unknown): r is TResult<any> =>
  Boolean(r) && (r as any)._tag === 'Result';

const isErr = (result: TResult<any>): result is ErrorResult =>
  isResult(result) && result.status === 'error';

const isOk = <TData>(result: TResult<TData>): result is SuccessResult<TData> =>
  isResult(result) && result.status === 'success';

// const map: <A, B>(f: (a: A) => B) => (fa: TResult<A>) => TResult<B> = f => fa =>
//   isErr(fa) ? fa : ok({ data: f(fa.data) });

export const Result = {
  isErr,
  err,
  isOk,
  ok,
  // map,
};
