import { db } from '../connection-pool';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import {
  SELECT_RESOURCE_BY_ID,
  SELECT_RESOURCE_IDS_WHERE_NAME_CONTAINS,
  SELECT_RESOURCE_IN_IDS,
} from './sql/resource-get-sql';

export type ReferrableResourceSearchResult = {
  name: string;
  id: string;
};

// The full resource & the search result are synonyms for now, but the full resource should grow to be a superset
export type ReferrableResource = ReferrableResourceSearchResult;

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferrableResource | null> =>
  db.task(async t => t.oneOrNone(SELECT_RESOURCE_BY_ID, { accountSid, resourceId }));

export const getByIdList = async (
  accountSid: AccountSID,
  resourceIds: string[],
): Promise<ReferrableResource[]> => {
  console.debug('Retrieving resources with IDs:', resourceIds);
  return db.task(async t => t.manyOrNone(SELECT_RESOURCE_IN_IDS, { accountSid, resourceIds }));
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
