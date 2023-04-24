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
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

import { getMockClient } from './mockClient';

type ClientCache = {
  [accountSid: string]: Twilio;
};

const clientCache: ClientCache = {};

const getClientOrMock = ({
  accountSid,
  authToken,
}: {
  accountSid: string;
  authToken: string;
}): Twilio => {
  if (authToken === 'mockAuthToken') {
    const mock = (getMockClient({ accountSid }) as unknown) as Twilio;
    return mock;
  }

  return new Twilio(accountSid, authToken);
};

export const getClient = async ({
  accountSid,
  authToken,
}: {
  accountSid: string;
  authToken?: string;
}): Promise<Twilio> => {
  if (!authToken) {
    authToken = await getSsmParameter(`/${process.env.NODE_ENV}/twilio/${accountSid}/auth_token`);
  }

  if (!clientCache[accountSid]) {
    clientCache[accountSid] = getClientOrMock({ accountSid, authToken });
  }

  return clientCache[accountSid];
};
