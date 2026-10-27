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

import { getAccountSidsByShortCode, getRegionsByAccountSid } from '../../accountSids';
import { lazyTfAdminCredentials } from '../../adminRoles';

const NO_SHORT_CODE = '(no short code)';
const NO_REGION = '(no region)';

export const command = 'list-accounts';
export const describe =
  'List the account short codes and sids in an environment, grouped by region';

export const builder = {
  e: {
    alias: 'environment',
    describe: 'environment (e.g. development, staging, production)',
    demandOption: true,
    type: 'string',
  },
  r: {
    alias: 'region',
    describe: 'only list the accounts in this region (e.g. us-east-1)',
    type: 'string',
  },
};

export const handler = async ({
  environment,
  region,
}: {
  environment: string;
  region?: string;
}) => {
  try {
    // Both lookups share the credentials, so the tf-admin role is assumed once
    const getCredentials = lazyTfAdminCredentials();
    const [regionsByAccountSid, accountSidsByShortCode] = await Promise.all([
      getRegionsByAccountSid(environment, getCredentials),
      getAccountSidsByShortCode(environment, getCredentials),
    ]);

    const shortCodesByAccountSid: Record<string, string> = Object.fromEntries(
      Object.entries(accountSidsByShortCode).map(([shortCode, accountSid]) => [
        accountSid,
        shortCode,
      ]),
    );
    const accountSids = new Set([
      ...Object.keys(regionsByAccountSid),
      ...Object.values(accountSidsByShortCode),
    ]);

    const accountsByRegion: Record<string, { shortCode: string; accountSid: string }[]> =
      {};
    accountSids.forEach(accountSid => {
      const accountRegion = regionsByAccountSid[accountSid] ?? NO_REGION;
      if (region && accountRegion !== region) return;
      accountsByRegion[accountRegion] = [
        ...(accountsByRegion[accountRegion] ?? []),
        { shortCode: shortCodesByAccountSid[accountSid] ?? NO_SHORT_CODE, accountSid },
      ];
    });

    const regions = Object.keys(accountsByRegion).sort();
    if (!regions.length) {
      console.info(`No accounts found in ${environment}${region ? ` ${region}` : ''}`);
      return;
    }

    regions.forEach(accountRegion => {
      const accounts = accountsByRegion[accountRegion].sort((a, b) =>
        a.shortCode.localeCompare(b.shortCode),
      );
      const shortCodeWidth = Math.max(...accounts.map(a => a.shortCode.length));
      console.info(`\n${environment} ${accountRegion} (${accounts.length} account(s))`);
      accounts.forEach(({ shortCode, accountSid }) =>
        console.info(`  ${shortCode.padEnd(shortCodeWidth)}  ${accountSid}`),
      );
    });
  } catch (err) {
    console.error(
      `Failed to list accounts for ${environment}${region ? ` ${region}` : ''}`,
      err instanceof Error ? err.message : String(err),
    );
  }
};
