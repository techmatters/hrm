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

import getConfig from './get-config';
import { getClient } from './client';

// TODO: handle document to body conversion based on a config file for this user/index

export const indexDocument = async ({
  accountSid,
  configId = 'default',
  document,
  id,
  indexType,
}: {
  accountSid: string;
  configId?: string;
  document: any;
  id: string;
  indexType: string;
}) => {
  const client = await getClient({ accountSid });

  const config = await getConfig({
    configId,
    indexType,
  });

  const index = `${accountSid.toLowerCase()}-${indexType}`;

  const body = config.convertDocument(document);

  return client.index({
    index,
    id,
    body,
  });
};
