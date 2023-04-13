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

import { getClient } from './client';
import getConfig from './get-config';

import getAccountSid from './get-account-sid';

export const createIndex = async ({
  accountSid,
  configId = 'default',
  indexType,
  shortCode,
  skipWaitForCreation = false,
}: {
  accountSid?: string;
  configId?: string;
  indexType: string;
  shortCode?: string;
  skipWaitForCreation?: boolean;
}) => {
  if (!accountSid) {
    accountSid = await getAccountSid(shortCode!);
  }

  const config = await getConfig({
    configId,
    indexType,
  });

  const body = config.createIndexBody;
  const client = await getClient({ accountSid });
  const index = `${accountSid.toLowerCase()}-${indexType}`;

  if (await client.indices.exists({ index })) {
    return;
  }

  const res = await client.indices.create({
    index,
    body,
  });

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
