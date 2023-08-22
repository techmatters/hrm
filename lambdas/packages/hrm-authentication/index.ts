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
import {
  newErrorResult,
  newSuccessResult,
  ErrorResult,
  SuccessResult,
} from '@tech-matters/types';

export type AuthenticateSuccessResult = SuccessResult & {
  result: true;
};

export type AuthenticateResult = ErrorResult | AuthenticateSuccessResult;

export type AuthenticateParameters = {
  accountSid: string;
  method: string;
  objectType: string;
  objectId?: string;
  fileType: string;
};

export const authenticate = async (
  params: AuthenticateParameters,
): Promise<AuthenticateResult> => {
  const { accountSid } = params;

  if (accountSid === 'mockAccountSid') {
    return newSuccessResult({ result: true });
  }

  return newErrorResult({
    message: 'Invalid accountSid',
  });
};
