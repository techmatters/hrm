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

import { CommonParams, Jwt } from './types';
import { getSecret } from './getSecret';

export type GenerateJwtParams = CommonParams & {
  permissions: string[];
  expirationSeconds?: number;
  issuer: string;
};

export const generateJwt = async ({
  accountSid,
  expirationSeconds = 30, // Expires in 30 seconds
  issuer,
  permissions,
}: GenerateJwtParams) => {
  const payload: Jwt = {
    sub: accountSid,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + expirationSeconds,
    grant: {
      permissions,
    },
  };

  return jwt.sign(payload, await getSecret(accountSid));
};
