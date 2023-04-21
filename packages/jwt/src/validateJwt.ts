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
import jwt from 'jsonwebtoken';
import { CommonParams, JwtGrants } from './types';
import { getSecret } from './getSecret';

export type ValidateJwtParams = CommonParams & {
  token: string;
};

export const validateJwt = ({
  accountSid,
  authToken,
  token,
}: ValidateJwtParams): JwtGrants | false => {
  let decoded: any;
  try {
    decoded = jwt.verify(token, getSecret(authToken));
  } catch (e) {
    return false;
  }

  if (decoded.accountSid !== accountSid) return false;

  return decoded.grants;
};
