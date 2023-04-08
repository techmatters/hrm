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

import { Client } from '@elastic/elasticsearch';
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

// import { getMockClient } from './mockClient';

type ClientCache = {
  [accountSid: string]: Client;
};

const clientCache: ClientCache = {};

const getSsmParameterKey = (accountSid: string) =>
  `/${process.env.NODE_ENV}/resources/${accountSid}/elasticsearch_config`;

const getClientOrMock = async ({ accountSid }: { accountSid: string }): Promise<Client> => {
  // if (authToken === 'mockAuthToken') {
  //   const mock = (getMockClient({ accountSid }) as unknown) as Twilio;
  //   return mock;
  // }

  const config = JSON.parse(await getSsmParameter(getSsmParameterKey(accountSid)));

  return new Client(config);
};

export const getClient = async ({ accountSid }: { accountSid: string }): Promise<Client> => {
  if (!clientCache[accountSid]) {
    clientCache[accountSid] = await getClientOrMock({ accountSid });
  }

  return clientCache[accountSid];
};
