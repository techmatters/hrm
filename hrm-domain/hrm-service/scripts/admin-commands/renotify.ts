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

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import type { HrmAccountId } from '@tech-matters/types';
import type { ManuallyTriggeredNotificationOperation } from '@tech-matters/hrm-types';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getAdminV0URL } from '../hrmInternalConfig';
import { getAccountSidsInRegion, toAccountSids } from '../accountSids';
import {
  CredentialsProvider,
  getTfAdminAssumeRoleParams,
  lazyTfAdminCredentials,
} from '../adminRoles';
// import envRegionMap from '../../../../.github/workflows/config/environment-region-map.json';

// yargs options shared by the commands that renotify, to target specific entities by id
export const idsOptions = {
  ids: {
    describe:
      "JSON list of the ids of the entities to target (e.g. --ids='[1, 2, 3]'). Requires exactly one entity type",
    type: 'string',
    conflicts: 'ids-file',
  },
  'ids-file': {
    describe:
      'path to a JSON file containing the list of the ids of the entities to target. Requires exactly one entity type',
    type: 'string',
  },
} as const;

/**
 * Reads the list of entity ids, either from a JSON string or from a JSON file.
 * Returns undefined if neither is given, so every entity in the date range is targeted.
 */
const readIds = ({
  ids,
  idsFile,
}: {
  ids?: string;
  idsFile?: string;
}): string[] | undefined => {
  if (ids === undefined && idsFile === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(idsFile === undefined ? ids : readFileSync(idsFile, 'utf8'));
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error(`ids must be a non empty JSON list, got: ${JSON.stringify(parsed)}`);
  }
  return parsed;
};

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
  getCredentials,
}: {
  accounts?: string[];
  excludeAccounts?: string[];
  environment: string;
  region: string;
  dryRun: boolean;
  getCredentials: CredentialsProvider;
}): Promise<HrmAccountId[] | undefined> => {
  // Resolve included and excluded short codes together, so SSM is only queried once
  const allSids = await toAccountSids({
    environment,
    accounts: [...(accounts ?? []), ...(excludeAccounts ?? [])],
    getCredentials,
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

    accountSids = await getAccountSidsInRegion({ environment, region, getCredentials });
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
  ids,
  entityType,
  internalResourcesUrl,
  operation,
}: {
  operation: ManuallyTriggeredNotificationOperation;
  entityType: 'contacts' | 'cases' | 'profiles';
  internalResourcesUrl: URL;
  accountSid: HrmAccountId;
  authKey: string;
  dateFrom?: string;
  dateTo?: string;
  ids?: string[];
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
    body: JSON.stringify({ dateFrom, dateTo, ids }),
  });

  if (!response.ok) {
    console.error(
      `Failed to submit request for ${operation} ${entityType}: ${response.statusText}`,
    );
    console.info(await response.text());
  } else {
    const target = ids ? `with ${ids.length} id(s)` : `from ${dateFrom} to ${dateTo}`;
    console.info(`Performing ${operation} ${entityType} ${target}...`);
    console.info(await response.text());
  }
};

export const renotify = async ({
  region,
  environment,
  accounts,
  dateFrom,
  dateTo,
  requireDateRange = false,
  ids: idsJson,
  idsFile,
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
  dateFrom?: string;
  dateTo?: string;
  // If set, dateFrom and dateTo are required unless ids are given
  requireDateRange?: boolean;
  ids?: string;
  idsFile?: string;
  contacts: boolean;
  cases: boolean;
  profiles: boolean;
  operation: ManuallyTriggeredNotificationOperation;
  dryRun?: boolean;
}) => {
  try {
    const ids = readIds({ ids: idsJson, idsFile });
    if (ids && [contacts, cases, profiles].filter(Boolean).length !== 1) {
      console.error('When targeting ids, exactly one entity type must be specified');
      return;
    }
    if (!ids && requireDateRange && !(dateFrom && dateTo)) {
      console.error('dateFrom and dateTo are required unless ids are specified');
      return;
    }

    const accountSids = await resolveAccountSids({
      accounts,
      excludeAccounts,
      environment,
      region,
      dryRun,
      // The tf-admin role is only assumed if SSM needs to be read to resolve the accounts
      getCredentials: lazyTfAdminCredentials(),
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
      if (ids) {
        console.info(`[dry run] targeting ${ids.length} id(s): ${ids.join(', ')}`);
      }
      return;
    }

    // TODO: access all regions (once eu-west-1 is accessible via management vpn)
    // console.log('envRegionMap', envRegionMap);
    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      assumeRoleParams: getTfAdminAssumeRoleParams(),
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
          ids,
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
          ids,
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
          ids,
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};
