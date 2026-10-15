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

import { createInterface } from 'node:readline/promises';
import type { HrmAccountId } from '@tech-matters/types';
import { getCachedParameters, loadPaginated } from '@tech-matters/ssm-cache';

const loadedPaths = new Map<string, Promise<void>>();

/**
 * Loads every parameter under the path into the SSM cache with a single paginated request.
 * Each path is only loaded once per run, as SSM rate limits are low.
 */
const loadPathOnce = (path: string, regex: RegExp) => {
  if (!loadedPaths.has(path)) {
    loadedPaths.set(path, loadPaginated({ path, regex }));
  }
  return loadedPaths.get(path)!;
};

/**
 * Looks up every account whose region SSM parameter (/<environment>/aws/<accountSid>/region)
 * matches the given region, and returns their account sids
 */
export const getAccountSidsInRegion = async ({
  environment,
  region,
}: {
  environment: string;
  region: string;
}): Promise<HrmAccountId[]> => {
  const regionParameterRegex = new RegExp(`^/${environment}/aws/([^/]+)/region$`);
  await loadPathOnce(`/${environment}/aws/`, regionParameterRegex);

  return Object.entries(getCachedParameters(regionParameterRegex))
    .filter(([, accountRegion]) => accountRegion === region)
    .map(([name]) => name.match(regionParameterRegex)![1] as HrmAccountId)
    .sort();
};

const ACCOUNT_SID_REGEX = /^AC[0-9a-f]{32}$/i;

/**
 * Maps each account (short code or account sid) to its account sid.
 * Short codes are resolved from their /<environment>/twilio/<SHORT_CODE>/account_sid SSM parameters,
 * all loaded in a single path request rather than one request per account.
 */
export const toAccountSids = async ({
  environment,
  accounts,
}: {
  environment: string;
  accounts: string[];
}): Promise<HrmAccountId[]> => {
  if (accounts.every(account => ACCOUNT_SID_REGEX.test(account))) {
    return accounts as HrmAccountId[];
  }

  const accountSidParameterRegex = new RegExp(
    `^/${environment}/twilio/([^/]+)/account_sid$`,
  );
  await loadPathOnce(`/${environment}/twilio/`, accountSidParameterRegex);
  const sidsByShortCode = Object.fromEntries(
    Object.entries(getCachedParameters(accountSidParameterRegex)).map(
      ([name, accountSid]) => [name.match(accountSidParameterRegex)![1], accountSid],
    ),
  );

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

export const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
};
