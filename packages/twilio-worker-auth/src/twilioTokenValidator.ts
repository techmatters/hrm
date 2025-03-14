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

import { validator as TokenValidator } from 'twilio-flex-token-validator';
import { newOk, newErr } from '@tech-matters/types';

type TokenValidatorResponse = { worker_sid: string; roles: string[] };

const isWorker = (tokenResult: TokenValidatorResponse) =>
  Boolean(tokenResult.worker_sid) && tokenResult.worker_sid.startsWith('WK');
const isGuest = (tokenResult: TokenValidatorResponse) =>
  Array.isArray(tokenResult.roles) && tokenResult.roles.includes('guest');

export const twilioTokenValidator = async ({
  accountSid,
  authToken,
  token,
}: {
  accountSid: string;
  authToken: string;
  token: string;
}) => {
  try {
    const tokenResult = <TokenValidatorResponse>(
      await TokenValidator(token, accountSid, authToken)
    );
    if (!isWorker(tokenResult) || isGuest(tokenResult)) {
      return newErr({
        error: 'Token authentication failed',
        message: 'Guest token provided',
      });
    }

    return newOk({ data: tokenResult });
  } catch (err) {
    console.error(err);
    return newErr({
      error: err,
      message: 'Invalid token provided',
    });
  }
};
