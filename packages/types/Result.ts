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
  readonly _tag: 'Result';
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

export const newErr = ({
  message,
  statusCode = 500,
  name = 'Error',
}: NewErrorResultParams): ErrorResult => ({
  _tag: 'Result',
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

export const newOk = <TData>({
  data,
  statusCode = 200,
}: NewSuccessResultParms<TData>): SuccessResult<TData> => ({
  _tag: 'Result',
  status: 'success',
  data,
  statusCode,
});

export type TResult<TData> = SuccessResult<TData> | ErrorResult;

const isResult = (r: unknown): r is TResult<any> => (r as any)?._tag === 'Result';

export const isErr = (result: TResult<any>): result is ErrorResult =>
  isResult(result) && result.status === 'error';

export const isOk = <TData>(result: TResult<TData>): result is SuccessResult<TData> =>
  isResult(result) && result.status === 'success';
