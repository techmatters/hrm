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

  const indexConfig = await getConfig({
    configId,
    indexType,
    configType: 'create-index',
  });

  const body = indexConfig.body;

  const client = await getClient({ accountSid });

  const index = `${accountSid.toLowerCase()}-${indexType}`;

  if (await client.indices.exists({ index })) {
    return;
  }

  const res = await client.indices.create({
    index,
    body,
  });

  if (skipWaitForCreation) return res;

  console.log(
    await client.cluster.health({
      index,
      level: 'indices',
      wait_for_status: 'yellow',
      timeout: '10s',
    }),
  );

  return res;
};

export default createIndex;
