import { AccountSID } from '@tech-matters/twilio-worker-auth';
import {
  getById,
  getByIdList,
  getWhereNameContains,
  ReferrableResource,
} from './resource-data-access';

export type SearchParameters = {
  ids: string[];
  nameSubstring?: string;
  pagination: {
    limit: number;
    start: number;
  };
};

const EMPTY_RESULT = { totalCount: 0, results: [] };

export const getResource = (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferrableResource | null> => getById(accountSid, resourceId);

export const searchResources = async (
  accountSid: AccountSID,
  { nameSubstring, ids = [], pagination: { limit, start } }: SearchParameters,
): Promise<{ totalCount: number; results: ReferrableResource[] }> => {
  console.log('IDs specified in request:', ids);
  const { results: idsOfNameMatches, totalCount: nameSearchTotalCount } = nameSubstring
    ? await getWhereNameContains(accountSid, nameSubstring, start, limit)
    : EMPTY_RESULT;
  const idsToLoad = [...idsOfNameMatches, ...ids.filter(id => !idsOfNameMatches.includes(id))];
  if (!idsToLoad.length) return { results: [], totalCount: nameSearchTotalCount };
  console.log('Retrieving resources with IDs:', idsToLoad);
  // This might well be more than needed to meet the 'limit' criteria but best to query them all in case any of them 'miss'
  const unsortedResourceList = await getByIdList(accountSid, idsToLoad);
  const resourceMap = Object.fromEntries(
    unsortedResourceList.map(resource => [resource.id, resource]),
  );
  const untrimmedResults = idsToLoad
    .map(id => {
      const mappedValue = resourceMap[id];
      // So each value is only used once
      delete resourceMap[id];
      return mappedValue;
    })
    .filter(r => r);

  const resultsStartIndex = Math.max(0, start - nameSearchTotalCount); // If the start point is past the end of those returned in the name search, we need to drop some from the start of the result set to return the correct paginated window
  const totalCount = nameSearchTotalCount + (untrimmedResults.length - idsOfNameMatches.length);
  const results = untrimmedResults.slice(resultsStartIndex, resultsStartIndex + limit);
  return { results, totalCount };
};
