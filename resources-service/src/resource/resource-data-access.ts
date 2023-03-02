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

import { db } from '../connection-pool';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import {
  SELECT_RESOURCE_IDS_WHERE_NAME_CONTAINS,
  SELECT_RESOURCE_IN_IDS,
} from './sql/resource-get-sql';

export type ReferrableResourceAttribute = {
  value: string;
  language: string;
  info?: any;
};

export type ReferrableResourceRecord = {
  name: string;
  id: string;
  attributes: (ReferrableResourceAttribute & { key: string })[];
};

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferrableResourceRecord | null> => {
  const res = await db.task(async t =>
    t.oneOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds: [resourceId] }),
  );
  console.debug('Retrieved resource:', JSON.stringify(res, null, 2));
  return res;
};

export const getByIdList = async (
  accountSid: AccountSID,
  resourceIds: string[],
): Promise<ReferrableResourceRecord[]> => {
  console.debug('Retrieving resources with IDs:', resourceIds);
  const res = await db.task(async t =>
    t.manyOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds }),
  );
  console.debug('Retrieved resources:', JSON.stringify(res, null, 2));
  return res;
};

export const getWhereNameContains = async (
  accountSid: AccountSID,
  nameSubstring: string,
  start: number,
  limit: number,
): Promise<{ totalCount: number; results: string[] }> => {
  const [dataResultSet, countResultSet] = await db.task(async t =>
    t.multi(SELECT_RESOURCE_IDS_WHERE_NAME_CONTAINS, {
      accountSid,
      namePattern: `%${nameSubstring}%`,
      start,
      limit,
    }),
  );
  return {
    totalCount: countResultSet[0].totalCount,
    results: dataResultSet.map(record => record.id),
  };
};
