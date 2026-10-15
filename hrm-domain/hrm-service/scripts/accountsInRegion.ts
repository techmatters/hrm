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
  await loadPaginated({ path: `/${environment}/aws/`, regex: regionParameterRegex });

  return Object.entries(getCachedParameters(regionParameterRegex))
    .filter(([, accountRegion]) => accountRegion === region)
    .map(([name]) => name.match(regionParameterRegex)![1] as HrmAccountId)
    .sort();
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
