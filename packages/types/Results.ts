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

export type NewErrorResultParams = {
  message: string;
  statusCode?: number;
  name?: string;
};

export const newErrorResult = ({
  message,
  statusCode = 500,
  name = 'Error',
}: NewErrorResultParams) => ({
  status: 'error',
  message,
  statusCode,
  name,
});

export type ErrorResult = ReturnType<typeof newErrorResult>;

//TODO: use generic type for result
export type NewSuccessResultParms<TData> = {
  data: TData;
  statusCode?: number;
};

export const newSuccessResult = <TData>({
  data,
  statusCode = 200,
}: NewSuccessResultParms<TData>) => ({
  status: 'success',
  data,
  statusCode,
});

export type SuccessResult<TData> = ReturnType<typeof newSuccessResult<TData>>;

export type NewUnneededResultParams = {
  message: string;
};
export const newUnneededResult = ({ message }: NewUnneededResultParams) => ({
  status: 'unneeded',
  message,
});
export type UnneededResult = ReturnType<typeof newUnneededResult>;

export type Result<TData> = SuccessResult<TData> | ErrorResult | UnneededResult;

export const isErrorResult = (result: Result<any>): result is ErrorResult =>
  result.status === 'error';

export const isSuccessResult = <TData>(
  result: Result<TData>,
): result is SuccessResult<TData> => result.status === 'success';

export const isUnneededResult = (result: Result<any>): result is UnneededResult =>
  result.status === 'unneeded';
