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
import { Client as EsClient, ClientOptions } from '@elastic/elasticsearch';
import { IndicesRefreshResponse } from '@elastic/elasticsearch/lib/api/types';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  indexDocumentBulk,
  IndexDocumentBulkExtraParams,
  IndexDocumentBulkResponse,
} from './indexDocumentBulk';
import { createIndex, CreateIndexExtraParams, CreateIndexResponse } from './createIndex';
import { deleteIndex, DeleteIndexResponse } from './deleteIndex';
import { indexDocument, IndexDocumentExtraParams, IndexDocumentResponse } from './indexDocument';
import getAccountSid from './getAccountSid';
import { getIndexConfig, ConfigIds, IndexTypes } from './getIndexConfig';
import { search, SearchExtraParams, SearchResponse } from './search';

// import { getMockClient } from './mockClient';

export type Client = {
  client: EsClient;
  index: string;
  refreshIndex: () => Promise<IndicesRefreshResponse>;
  createIndex: (args: CreateIndexExtraParams) => Promise<CreateIndexResponse>;
  deleteIndex: () => Promise<DeleteIndexResponse>;
  indexDocument: (args: IndexDocumentExtraParams) => Promise<IndexDocumentResponse>;
  indexDocumentBulk: (args: IndexDocumentBulkExtraParams) => Promise<IndexDocumentBulkResponse>;
  search: (args: SearchExtraParams) => Promise<SearchResponse>;
};

type AccountSidOrShortCodeRequired =
  | {
      shortCode: string;
      accountSid?: string;
    }
  | {
      shortCode?: string;
      accountSid: string;
    };

export type GetClientArgs = {
  config?: ClientOptions;
  configId?: ConfigIds;
  indexType: IndexTypes;
} & AccountSidOrShortCodeRequired;

export type GetClientOrMockArgs = GetClientArgs & {
  index: string;
};

export type PassThroughConfig = {
  index: string;
  indexConfig: any;
  client: EsClient;
};

type ClientCache = {
  [accountSid: string]: Client;
};

const clientCache: ClientCache = {};
const getConfigSsmParameterKey = (indexType: string) =>
  `/${process.env.NODE_ENV}/${indexType}/${process.env.AWS_REGION}/elasticsearch_config`;

//TODO: type for config
const getEsConfig = async ({
  config,
  indexType,
}: {
  config: ClientOptions | undefined;
  indexType: string;
}) => {
  console.log('config', config);
  if (config) return config;
  const envConfigEntries = Object.entries(process.env)
    .filter(([key]) => key.startsWith('ELASTICSEARCH_CONFIG_'))
    .map(([varName, value]) => [varName.substring('ELASTICSEARCH_CONFIG_'.length), value]);
  console.log('envConfigEntries', envConfigEntries);
  if (process.env.ELASTICSEARCH_CONFIG || envConfigEntries.length) {
    return {
      ...(process.env.ELASTICSEARCH_CONFIG ? JSON.parse(process.env.ELASTICSEARCH_CONFIG) : {}),
      ...Object.fromEntries(envConfigEntries),
    };
  }

  return JSON.parse(await getSsmParameter(getConfigSsmParameterKey(indexType)));
};

const getClientOrMock = async (params: GetClientOrMockArgs) => {
  // TODO: mock client for unit tests
  // if (authToken === 'mockAuthToken') {
  //   const mock = (getMockClient({ config }) as unknown) as Twilio;
  //   return mock;
  // }

  const { config, configId, index, indexType } = params;
  const client = new EsClient(await getEsConfig({ config, indexType }));
  const indexConfig = await getIndexConfig({
    configId,
    indexType,
  });
  const passThroughConfig: PassThroughConfig = {
    index,
    indexConfig,
    client,
  };

  return {
    client,
    index,
    /**
     * Waits for an index refresh of pending changes to be completed. This is useful in tests
     * where we want to make sure that the index is up to date before we test search results.
     */
    refreshIndex: () => client.indices.refresh({ index }),
    createIndex: (args: CreateIndexExtraParams) => createIndex({ ...passThroughConfig, ...args }),
    deleteIndex: () => deleteIndex(passThroughConfig),
    indexDocument: (args: IndexDocumentExtraParams) =>
      indexDocument({ ...passThroughConfig, ...args }),
    indexDocumentBulk: (args: IndexDocumentBulkExtraParams) =>
      indexDocumentBulk({ ...passThroughConfig, ...args }),
    search: (args: SearchExtraParams) => search({ ...passThroughConfig, ...args }),
  };
};

/**
 * Returns a client for the given accountSid/indexType. Currently clients connections are really
 * only based on AWS region and we assume there will be a single multi-tenant ES cluster per region
 * and or region/type. This may change in the future if we need to support single tenant ES clusters.
 */
export const getClient = async (params: GetClientArgs): Promise<Client> => {
  let { accountSid } = params;
  const { indexType } = params;

  if (!accountSid) accountSid = await getAccountSid(params.shortCode!);
  const index = `${accountSid.toLowerCase()}-${indexType}`;
  if (!clientCache[index]) {
    clientCache[index] = await getClientOrMock({ ...params, accountSid, index });
  }

  return clientCache[index];
};
