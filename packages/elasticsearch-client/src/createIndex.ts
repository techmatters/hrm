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
import { IndicesCreateResponse } from '@elastic/elasticsearch/lib/api/types';
import { PassThroughConfig } from './client';

export type CreateIndexExtraParams = {
  skipWaitForCreation?: boolean;
};

export type CreateIndexParams = PassThroughConfig<any> & CreateIndexExtraParams;
export type CreateIndexResponse = IndicesCreateResponse | void;

export const createIndex = async ({
  client,
  index,
  indexConfig,
  skipWaitForCreation = false,
}: CreateIndexParams): Promise<CreateIndexResponse> => {
  if (await client.indices.exists({ index })) {
    return;
  }

  const params = indexConfig.getCreateIndexParams(index);
  const res = await client.indices.create(params);

  // This waits for the index to be created and for the shards to be allocated
  // so that we can be sure that the index is ready to be used before returning.
  // Can be skipped with the skipWaitForCreation flag if we are creating a bunch
  // of indexes and want to check for them all after the fact.
  if (skipWaitForCreation) return res;

  await client.cluster.health({
    index,
    level: 'indices',
    wait_for_status: 'yellow',
    timeout: '10s',
  });
  return res;
};

export default createIndex;
