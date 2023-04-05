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
  SELECT_UNINDEXED_RESOURCES,
} from './sql/resource-get-sql';

export type ReferrableResourceAttribute<T> = {
  value: T;
  info?: any;
};

export const isReferrableResourceAttribute = (
  attribute: any,
): attribute is ReferrableResourceAttribute =>
  attribute &&
  (typeof attribute.value === 'string' ||
    typeof attribute.value === 'number' ||
    typeof attribute.value === 'boolean');

export type ReferrableResourceTranslatableAttribute = ReferrableResourceAttribute<string> & {
  language: string;
};

export type ReferrableResourceRecord = {
  name: string;
  id: string;
  stringAttributes: (ReferrableResourceTranslatableAttribute & { key: string })[];
  booleanAttributes: (ReferrableResourceAttribute<boolean> & { key: string })[];
  numberAttributes: (ReferrableResourceAttribute<number> & { key: string })[];
  datetimeAttributes: (ReferrableResourceAttribute<string> & { key: string })[];
};

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferrableResourceRecord | null> => {
  const res = await db.task(async t =>
    t.oneOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds: [resourceId] }),
  );
  console.debug('Retrieved resource:', res.id);
  if (res) {
    delete res.accountSid;
  }
  return res as ReferrableResourceRecord;
};

export const getByIdList = async (
  accountSid: AccountSID,
  resourceIds: string[],
): Promise<ReferrableResourceRecord[]> => {
  if (!resourceIds.length) return [];
  console.debug('Retrieving resources with IDs:', resourceIds);
  const res = await db.task(async t =>
    t.manyOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds }),
  );
  console.debug('Retrieved resources:', res?.length);
  return res.map(rr => {
    const { accountSid: acct, ...rest } = rr;
    return rest;
  });
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

/**
 * THIS FUNCTION PULLS DATA FOR MULTIPLE ACCOUNTS
 * It must NEVER BE accessed from an endpoint that is accessible with a Twilio user auth token
 * Maybe we should move it to a different file to make that clearer - or add security checking at this level.
 */
export const getUnindexed = async (
  limit: number,
): Promise<(ReferrableResourceRecord & {
  accountSid: AccountSID;
})[]> => {
  console.debug('Retrieving un-indexed resources');
  const res = await db.task(async t => t.manyOrNone(SELECT_UNINDEXED_RESOURCES, { limit }));
  console.debug(`Retrieved ${res.length} un-indexed resources`);
  return res;
};
