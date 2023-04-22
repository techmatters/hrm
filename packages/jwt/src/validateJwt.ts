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
import { CommonParams, Jwt, JwtGrant } from './types';
import { getSecret } from './getSecret';

export type ValidateJwtParams = CommonParams & {
  token: string;
};

export type ValidateJwtPermissionParams = ValidateJwtParams & {
  permission: string;
};

export type ValidateJwtResult = {
  success: boolean;
  message?: string;
  grant?: JwtGrant;
  issuer?: string;
};

export type DecodeJwtResult = {
  success: boolean;
  message?: string;
  decodedJwt?: Jwt;
};

export const JWT_BAD_SUBJECT = 'JWT subject does not match accountSid';

export const decodeJwt = async ({
  accountSid,
  token,
}: ValidateJwtParams): Promise<DecodeJwtResult> => {
  try {
    const decodedJwt = jwt.verify(token, await getSecret(accountSid)) as Jwt;
    return {
      success: true,
      decodedJwt,
    };
  } catch (e) {
    return {
      success: false,
      message: `Error decoding JWT: ${e}`,
    };
  }
};

export const validateJwt = async ({
  accountSid,
  token,
}: ValidateJwtParams): Promise<ValidateJwtResult> => {
  let decodeRes = await decodeJwt({ accountSid, token });

  if (!decodeRes.success) {
    return {
      success: false,
      message: decodeRes.message,
    };
  }

  if (decodeRes.decodedJwt?.sub !== accountSid) {
    return {
      success: false,
      message: JWT_BAD_SUBJECT,
    };
  }

  return {
    success: true,
    grant: decodeRes.decodedJwt?.grant,
    issuer: decodeRes.decodedJwt?.iss,
  };
};

export const validateJwtPermission = async ({
  accountSid,
  token,
  permission,
}: ValidateJwtPermissionParams): Promise<boolean> => {
  const result = await validateJwt({ accountSid, token });
  if (!result.success) return false;

  return result.grant!.permissions.includes(permission);
};
