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

import type { HrmAccountId } from '@tech-matters/types';
import { getCachedParameters, loadPaginated } from '@tech-matters/ssm-cache';
import type { CredentialsProvider } from './adminRoles';

const loadedPaths = new Map<string, Promise<void>>();

/**
 * Loads every parameter under the path into the SSM cache with a single paginated request.
 * Each path is only loaded once per run, as SSM rate limits are low.
 */
const loadPathOnce = (
  path: string,
  regex: RegExp,
  getCredentials: CredentialsProvider,
) => {
  if (!loadedPaths.has(path)) {
    loadedPaths.set(
      path,
      getCredentials().then(credentials => loadPaginated({ path, regex, credentials })),
    );
  }
  return loadedPaths.get(path)!;
};

/**
 * Loads the parameters under the path and maps the segment captured by the regex to the parameter value
 */
const getParametersByCapturedSegment = async (
  path: string,
  regex: RegExp,
  getCredentials: CredentialsProvider,
): Promise<Record<string, string>> => {
  await loadPathOnce(path, regex, getCredentials);
  return Object.fromEntries(
    Object.entries(getCachedParameters(regex)).map(([name, value]) => [
      name.match(regex)![1],
      value,
    ]),
  );
};

/**
 * Maps every account sid to its region, from the /<environment>/aws/<accountSid>/region SSM parameters
 */
export const getRegionsByAccountSid = (
  environment: string,
  getCredentials: CredentialsProvider,
): Promise<Record<string, string>> =>
  getParametersByCapturedSegment(
    `/${environment}/aws/`,
    new RegExp(`^/${environment}/aws/([^/]+)/region$`),
    getCredentials,
  );

/**
 * Maps every account short code to its account sid, from the /<environment>/twilio/<SHORT_CODE>/account_sid SSM parameters
 */
export const getAccountSidsByShortCode = (
  environment: string,
  getCredentials: CredentialsProvider,
): Promise<Record<string, HrmAccountId>> =>
  getParametersByCapturedSegment(
    `/${environment}/twilio/`,
    new RegExp(`^/${environment}/twilio/([^/]+)/account_sid$`),
    getCredentials,
  ) as Promise<Record<string, HrmAccountId>>;

/**
 * Looks up every account whose region SSM parameter (/<environment>/aws/<accountSid>/region)
 * matches the given region, and returns their account sids
 */
export const getAccountSidsInRegion = async ({
  environment,
  region,
  getCredentials,
}: {
  environment: string;
  region: string;
  getCredentials: CredentialsProvider;
}): Promise<HrmAccountId[]> =>
  Object.entries(await getRegionsByAccountSid(environment, getCredentials))
    .filter(([, accountRegion]) => accountRegion === region)
    .map(([accountSid]) => accountSid as HrmAccountId)
    .sort();

const ACCOUNT_SID_REGEX = /^AC[0-9a-f]{32}$/i;

/**
 * Maps each account (short code or account sid) to its account sid.
 * Short codes are resolved from their /<environment>/twilio/<SHORT_CODE>/account_sid SSM parameters,
 * all loaded in a single path request rather than one request per account.
 */
export const toAccountSids = async ({
  environment,
  accounts,
  getCredentials,
}: {
  environment: string;
  accounts: string[];
  getCredentials: CredentialsProvider;
}): Promise<HrmAccountId[]> => {
  if (accounts.every(account => ACCOUNT_SID_REGEX.test(account))) {
    return accounts as HrmAccountId[];
  }

  const sidsByShortCode = await getAccountSidsByShortCode(environment, getCredentials);

  const unknownShortCodes = accounts.filter(
    account =>
      !ACCOUNT_SID_REGEX.test(account) && !sidsByShortCode[account.toUpperCase()],
  );
  if (unknownShortCodes.length) {
    throw new Error(
      `No account sid found in SSM for short code(s) ${unknownShortCodes.join(
        ', ',
      )} in ${environment}`,
    );
  }

  return accounts.map(
    account =>
      (ACCOUNT_SID_REGEX.test(account)
        ? account
        : sidsByShortCode[account.toUpperCase()]) as HrmAccountId,
  );
};
