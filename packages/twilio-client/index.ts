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

import { Twilio } from 'twilio';
import { getSsmParameter } from '@tech-matters/ssm-cache';

import { getMockClient } from './mockClient';

export { isTwilioTaskTransferTarget } from './isTwilioTaskTransferTarget';
export { setMockTaskRouterWorkspaces } from './mockClient/taskRouterWorkspaces';

type ClientCache = {
  [accountSid: string]: Twilio;
};

export type TwilioClient = Twilio;

const clientCache: ClientCache = {};

const getClientOrMock = ({
  accountSid,
  authToken,
}: {
  accountSid: string;
  authToken: string;
}): Twilio => {
  if (authToken === 'mockAuthToken') {
    return getMockClient({ accountSid }) as unknown as Twilio;
  }

  return new Twilio(accountSid, authToken);
};

export const getAuthToken = async (
  accountSid: string,
  authToken: string | undefined,
): Promise<string> => {
  if (authToken) return authToken;

  if (process.env.TWILIO_CLIENT_USE_ENV_AUTH_TOKEN && process.env.TWILIO_AUTH_TOKEN) {
    return process.env.TWILIO_AUTH_TOKEN;
  }

  return getSsmParameter(`/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`);
};

export const getClient = async ({
  accountSid,
  authToken: authTokenParam,
}: {
  accountSid: string;
  authToken?: string;
}): Promise<Twilio> => {
  const authToken = await getAuthToken(accountSid, authTokenParam);

  if (!clientCache[accountSid]) {
    clientCache[accountSid] = getClientOrMock({ accountSid, authToken });
  }

  return clientCache[accountSid];
};
