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
  body?: any;
  statusCode?: number;
};

export const newErrorResult = ({
  body,
  message,
  statusCode = 500,
}: NewErrorResultParams) => ({
  status: 'error',
  body,
  message,
  statusCode,
});

export type ErrorResult = ReturnType<typeof newErrorResult>;

export type NewSuccessResultParms = {
  result: any;
  statusCode?: number;
};

export const newSuccessResult = ({
  result,
  statusCode = 200,
}: NewSuccessResultParms) => ({
  status: 'success',
  result,
  statusCode,
});

export type SuccessResult = ReturnType<typeof newSuccessResult>;

export type Result = SuccessResult | ErrorResult;

export const isErrorResult = (result: Result): result is ErrorResult =>
  result.status === 'error';
