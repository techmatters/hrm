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

// eslint-disable-next-line prettier/prettier
import type { ALBEvent, ALBResult } from 'aws-lambda';
import { twilioTokenValidator } from '@tech-matters/twilio-worker-auth';
import { isErr, newErr } from '@tech-matters/types';
import { getSsmParameter } from '@tech-matters/ssm-cache';

const validAccountSidsMap: { [env: string]: string[] } = {
  development: ['/development/twilio/AS/account_sid'],
  staging: ['/staging/twilio/AS/account_sid', '/staging/twilio/USCR/account_sid'],
};

const authenticateRequest = async ({
  accountSid,
  authHeader,
  environment,
}: {
  accountSid: string;
  authHeader: string;
  environment: string;
}) => {
  const validAccountSids = await Promise.all(
    validAccountSidsMap[environment].map(key => getSsmParameter(key)),
  );
  if (!validAccountSids.includes(accountSid)) {
    return newErr({
      error: 'Token authentication failed',
      message: `Account ${accountSid} not allowed to call this service`,
    });
  }

  const authToken = await getSsmParameter(
    `/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`,
  );

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer ') {
    return newErr({
      error: 'Token authentication failed',
      message: `Invalid auth type ${type}`,
    });
  }

  const result = await twilioTokenValidator({ accountSid, authToken, token });
  return result;
};

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  try {
    console.log(JSON.stringify(event));
    const payload = JSON.parse(event.body || '{}');
    const { headers } = event;

    const environment = process.env.NODE_ENV;
    if (!environment) {
      console.error(
        `custom-integrations/uscr-dispatcher: error: missing environment env var`,
      );
      return { statusCode: 500 };
    }

    const accountSid = payload.accountSid;
    if (!accountSid) {
      console.warn(
        `custom-integrations/uscr-dispatcher: error: missing accountSid in request payload`,
      );
      return { statusCode: 400 };
    }

    const authHeader = headers?.authorization;
    if (!authHeader) {
      console.warn(
        `custom-integrations/uscr-dispatcher: error: missing authorization in request headers`,
      );
      return { statusCode: 400 };
    }

    const authResult = await authenticateRequest({
      accountSid,
      authHeader,
      environment,
    });

    if (isErr(authResult)) {
      console.warn(authResult.error, authResult.message);
      return { statusCode: 401 };
    }

    console.debug(`custom-integrations/uscr-dispatcher: called with event ${event}`);
  } catch (err) {
    console.error(`custom-integrations/uscr-dispatcher: error: `, err);

    return { statusCode: 500 };
  }

  return {
    statusCode: 200,
  };
};
