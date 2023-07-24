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

import { AccountSID, FlatResource } from '@tech-matters/types';

import { db } from '../connection-pool';
import { SELECT_RESOURCE_IN_IDS } from './sql/resourceGetSql';

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<FlatResource | null> => {
  const res = await db.task(async t =>
    t.oneOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds: [resourceId] }),
  );
  if (res) {
    console.debug('Retrieved resource:', res.id);
    delete res.accountSid;
  } else {
    console.debug('Resource not found:', resourceId);
  }
  return res;
};

export const getByIdList = async (
  accountSid: AccountSID,
  resourceIds: string[],
): Promise<FlatResource[]> => {
  if (!resourceIds.length) return [];
  console.debug('Retrieving resources with IDs:', resourceIds);
  const res = await db.task(async t =>
    t.manyOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds }),
  );
  console.debug('Retrieved resources:', res?.length);
  return res;
};
