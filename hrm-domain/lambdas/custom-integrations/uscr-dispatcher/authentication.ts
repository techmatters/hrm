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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import { twilioTokenValidator } from '@tech-matters/twilio-worker-auth';
import { isErr, newErr, newOk } from '@tech-matters/types';

const validAccountSidsMap: { [env: string]: string[] } = {
  development: ['/development/twilio/AS/account_sid'],
  staging: ['/staging/twilio/AS/account_sid', '/staging/twilio/USCR/account_sid'],
  production: ['/production/twilio/USCR/account_sid'],
};

const AuthenticationError = 'AuthenticationError';

export const authenticateRequest = async ({
  accountSid,
  authHeader,
  environment,
}: {
  accountSid: string;
  authHeader: string;
  environment: string;
}) => {
  try {
    const validAccountSids = await Promise.all(
      validAccountSidsMap[environment].map(key => getSsmParameter(key)),
    );
    if (!validAccountSids.includes(accountSid)) {
      return newErr({
        error: AuthenticationError,
        message: `Account ${accountSid} not allowed to call this service`,
      });
    }

    const authToken = await getSsmParameter(
      `/${environment}/twilio/${accountSid}/auth_token`,
    );

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer') {
      return newErr({
        error: AuthenticationError,
        message: `Invalid auth type ${type}`,
      });
    }

    const result = await twilioTokenValidator({ accountSid, authToken, token });

    if (isErr(result)) {
      return result;
    }

    const staticKey = await getSsmParameter(
      `/${environment}/twilio/${accountSid}/static_key`,
    );

    return newOk({ data: { ...result.data, staticKey } });
  } catch (err) {
    return newErr({
      error: err,
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};
