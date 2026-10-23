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
import type { ManuallyTriggeredNotificationOperation } from '@tech-matters/hrm-types';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getAdminV0URL } from '../hrmInternalConfig';
import { getAccountSidsInRegion, toAccountSids } from '../accountSids';
// import envRegionMap from '../../../../.github/workflows/config/environment-region-map.json';

const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
};

/**
 * Resolves the account sids to run the command against.
 * Accounts can be short codes or account sids.
 * If no accounts are provided, uses every account in the given region, after user confirmation.
 * Any account in excludeAccounts (short codes or sids) is left out.
 * Returns undefined if the user doesn't confirm.
 */
const resolveAccountSids = async ({
  accounts,
  excludeAccounts,
  environment,
  region,
  dryRun,
}: {
  accounts?: string[];
  excludeAccounts?: string[];
  environment: string;
  region: string;
  dryRun: boolean;
}): Promise<HrmAccountId[] | undefined> => {
  // Resolve included and excluded short codes together, so SSM is only queried once
  const allSids = await toAccountSids({
    environment,
    accounts: [...(accounts ?? []), ...(excludeAccounts ?? [])],
  });
  const includedSids = allSids.slice(0, accounts?.length ?? 0);
  const excludedSids = allSids.slice(accounts?.length ?? 0);

  let accountSids: HrmAccountId[];
  if (accounts?.length) {
    accountSids = includedSids;
  } else {
    // Nothing is run on a dry run, so there's nothing to confirm
    if (
      !dryRun &&
      !(await confirm(
        `running cli for every account in the region ${region}, are you sure?`,
      ))
    ) {
      return undefined;
    }

    accountSids = await getAccountSidsInRegion({ environment, region });
  }

  if (excludedSids.length) {
    console.info(`Excluding account(s): ${excludedSids.join(', ')}`);
  }
  return accountSids.filter(accountSid => !excludedSids.includes(accountSid));
};

const requestRenotify = async ({
  accountSid,
  authKey,
  dateFrom,
  dateTo,
  entityType,
  internalResourcesUrl,
  operation,
}: {
  operation: ManuallyTriggeredNotificationOperation;
  entityType: 'contacts' | 'cases' | 'profiles';
  internalResourcesUrl: URL;
  accountSid: HrmAccountId;
  authKey: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const url = getAdminV0URL(
    internalResourcesUrl,
    accountSid,
    `/${entityType}/${operation}`,
  );

  console.info(`Submitting request to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authKey}`,
    },
    body: JSON.stringify({ dateFrom, dateTo }),
  });

  if (!response.ok) {
    console.error(
      `Failed to submit request for ${operation} ${entityType}: ${response.statusText}`,
    );
    console.info(await response.text());
  } else {
    console.info(
      `Performing ${operation} ${entityType} from ${dateFrom} to ${dateTo}...`,
    );
    console.info(await response.text());
  }
};

export const renotify = async ({
  region,
  environment,
  accounts,
  dateFrom,
  dateTo,
  contacts,
  cases,
  profiles,
  operation,
  excludeAccounts,
  dryRun = false,
}: {
  region: string;
  environment: string;
  accounts?: string[];
  excludeAccounts?: string[];
  dateFrom: string;
  dateTo: string;
  contacts: boolean;
  cases: boolean;
  profiles: boolean;
  operation: ManuallyTriggeredNotificationOperation;
  dryRun?: boolean;
}) => {
  try {
    const accountSids = await resolveAccountSids({
      accounts,
      excludeAccounts,
      environment,
      region,
      dryRun,
    });

    if (!accountSids) {
      console.info('Aborted');
      return;
    }

    if (dryRun) {
      console.info(
        `[dry run] ${operation} would run for ${accountSids.length} account(s) in ${environment} ${region}:`,
      );
      accountSids.forEach(accountSid => console.info(`  ${accountSid}`));
      return;
    }

    // TODO: access all regions (once eu-west-1 is accessible via management vpn)
    // console.log('envRegionMap', envRegionMap);
    const timestamp = new Date().getTime();
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
      RoleSessionName: `hrm-admin-cli-${timestamp}`,
    };

    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      assumeRoleParams,
    });

    for (const accountSid of accountSids) {
      console.log(`Processing ${operation} request for account ${accountSid}`);
      if (contacts) {
        await requestRenotify({
          operation,
          entityType: 'contacts',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }

      if (cases) {
        await requestRenotify({
          operation,
          entityType: 'cases',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }

      if (profiles) {
        await requestRenotify({
          operation,
          entityType: 'profiles',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};
