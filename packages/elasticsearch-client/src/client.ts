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

const getSsmParameterKey = (indexType: string) =>
  `/${process.env.NODE_ENV}/${indexType}/${process.env.AWS_REGION}/elasticsearch_config`;

//TODO: type for config
const getEsConfig = async ({ config, indexType }: { config: any; indexType: string }) => {
  if (config) return config;

  if (process.env.ELASTICSEARCH_CONFIG) {
    return JSON.parse(process.env.ELASTICSEARCH_CONFIG);
  } else {
    return JSON.parse(await getSsmParameter(getSsmParameterKey(indexType)));
  }
};

const getClientOrMock = async ({
  config,
  indexType,
}: {
  config: any;
  indexType: string;
}): Promise<Client> => {
  // TODO: mock client for unit tests
  // if (authToken === 'mockAuthToken') {
  //   const mock = (getMockClient({ config }) as unknown) as Twilio;
  //   return mock;
  // }

  return new Client(await getEsConfig({ config, indexType }));
};

/**
 * Returns a client for the given accountSid/indexType. Currently clients are really only based on AWS region
 * and we assume there will be a single multi-tenant ES cluster per region and or region/type. This may change
 * in the future if we need to support single tenant ES clusters.
 */
export const getClient = async ({
  accountSid,
  config,
  indexType = 'resources',
}: {
  accountSid: string;
  config?: any;
  indexType?: string;
}): Promise<Client> => {
  if (!clientCache[`${accountSid}-${indexType}`]) {
    clientCache[`${accountSid}-${indexType}`] = await getClientOrMock({ config, indexType });
  }

  return clientCache[`${accountSid}-${indexType}`];
};
