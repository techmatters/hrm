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
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { executeBulk, ExecuteBulkExtraParams, ExecuteBulkResponse } from './executeBulk';
import { createIndex, CreateIndexExtraParams, CreateIndexResponse } from './createIndex';
import { deleteIndex, DeleteIndexResponse } from './deleteIndex';
import {
  indexDocument,
  IndexDocumentExtraParams,
  IndexDocumentResponse,
} from './indexDocument';
import {
  updateDocument,
  UpdateDocumentExtraParams,
  UpdateDocumentResponse,
  updateScript,
  UpdateScriptExtraParams,
} from './updateDocument';
import getAccountSid from './getAccountSid';
import { search, SearchExtraParams } from './search';
import { suggest, SuggestExtraParams } from './suggest';
import { SearchConfiguration, IndexConfiguration } from './config';
import { IndicesRefreshResponse } from '@elastic/elasticsearch/lib/api/types';

// import { getMockClient } from './mockClient';
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
  indexType: string;
  ssmConfigParameter?: string;
} & AccountSidOrShortCodeRequired;

export type GetClientOrMockArgs = GetClientArgs & {
  index: string;
};

export type PassThroughConfig<T> = {
  index: string;
  indexConfig: IndexConfiguration<T>;
  client: EsClient;
};

const getConfigSsmParameterKey = (indexType: string) =>
  `/${process.env.NODE_ENV}/${indexType}/${process.env.AWS_REGION}/elasticsearch_config`;

//TODO: type for config
const getEsConfig = async ({
  config,
  indexType,
  ssmConfigParameter,
}: {
  config: ClientOptions | undefined;
  indexType: string;
  ssmConfigParameter?: string;
}) => {
  console.log('config', config);
  if (config) return config;
  const envConfigEntries = Object.entries(process.env)
    .filter(([key]) => key.startsWith('ELASTICSEARCH_CONFIG_'))
    .map(([varName, value]) => [
      varName.substring('ELASTICSEARCH_CONFIG_'.length),
      value,
    ]);
  console.log('envConfigEntries', envConfigEntries);
  if (process.env.ELASTICSEARCH_CONFIG || envConfigEntries.length) {
    return {
      ...(process.env.ELASTICSEARCH_CONFIG
        ? JSON.parse(process.env.ELASTICSEARCH_CONFIG)
        : {}),
      ...Object.fromEntries(envConfigEntries),
    };
  }

  if (ssmConfigParameter) {
    return JSON.parse(await getSsmParameter(ssmConfigParameter));
  }

  return JSON.parse(await getSsmParameter(getConfigSsmParameterKey(indexType)));
};

/**
 * Created this type explicitly because ReturnType<> doesn't work with generics
 */
export type IndexClient<T> = {
  indexDocument: (args: IndexDocumentExtraParams<T>) => Promise<IndexDocumentResponse>;
  updateDocument: (args: UpdateDocumentExtraParams<T>) => Promise<UpdateDocumentResponse>;
  updateScript: (args: UpdateScriptExtraParams<T>) => Promise<UpdateDocumentResponse>;
  refreshIndex: () => Promise<IndicesRefreshResponse>;
  executeBulk: (args: ExecuteBulkExtraParams<T>) => Promise<ExecuteBulkResponse>;
  createIndex: (args: CreateIndexExtraParams) => Promise<CreateIndexResponse>;
  deleteIndex: () => Promise<DeleteIndexResponse>;
};

const getClientOrMock = async ({
  config,
  index,
  indexType,
  ssmConfigParameter,
}: GetClientOrMockArgs) => {
  // TODO: mock client for unit tests
  // if (authToken === 'mockAuthToken') {
  //   const mock = (getMockClient({ config }) as unknown) as Twilio;
  //   return mock;
  // }

  const client = new EsClient(
    await getEsConfig({ config, indexType, ssmConfigParameter }),
  );
  return {
    client,
    index,
    searchClient: (searchConfig: SearchConfiguration) => ({
      search: (args: SearchExtraParams) =>
        search({ client, index, searchConfig, ...args }),
      suggest: (args: SuggestExtraParams) =>
        suggest({ client, index, searchConfig, ...args }),
    }),
    indexClient: <T>(indexConfig: IndexConfiguration<T>): IndexClient<T> => {
      const passThroughConfig: PassThroughConfig<T> = {
        index,
        indexConfig,
        client,
      };

      return {
        /**
         * Waits for an index refresh of pending changes to be completed. This is useful in tests
         * where we want to make sure that the index is up to date before we test search results.
         */
        refreshIndex: () => client.indices.refresh({ index }),
        createIndex: (args: CreateIndexExtraParams) =>
          createIndex({ ...passThroughConfig, ...args }),
        deleteIndex: () => deleteIndex(passThroughConfig),
        indexDocument: (args: IndexDocumentExtraParams<T>) =>
          indexDocument({ ...passThroughConfig, ...args }),
        updateDocument: (args: UpdateDocumentExtraParams<T>) =>
          updateDocument({ ...passThroughConfig, ...args }),
        updateScript: (args: UpdateScriptExtraParams<T>) =>
          updateScript({ ...passThroughConfig, ...args }),
        executeBulk: (args: ExecuteBulkExtraParams<T>) =>
          executeBulk({ ...passThroughConfig, ...args }),
      };
    },
  };
};

export type Client = Awaited<ReturnType<typeof getClientOrMock>>;

type ClientCache = {
  [accountSid: string]: Client;
};

const clientCache: ClientCache = {};

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
