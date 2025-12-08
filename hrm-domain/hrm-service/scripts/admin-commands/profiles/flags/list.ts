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

import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getAdminV0URL } from '../../../hrmInternalConfig';

export const command = 'list';
export const describe = 'List the profile flags for the given account';
export const builder = {
  e: {
    alias: 'environment',
    describe: 'environment (e.g. development, staging, production)',
    demandOption: true,
    type: 'string',
  },
  r: {
    alias: 'region',
    describe: 'region (e.g. us-east-1)',
    demandOption: true,
    type: 'string',
  },
  a: {
    alias: 'accountSid',
    describe: 'account SID',
    demandOption: true,
    type: 'string',
  },
};

export const handler = async ({ region, environment, accountSid }) => {
  try {
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

    const url = getAdminV0URL(internalResourcesUrl, accountSid, '/profiles/flags');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to submit request: ${response.statusText}`);
    }

    const jsonResp = await response.json();
    console.info(JSON.stringify(jsonResp, null, 2));
  } catch (err) {
    console.error(
      `Failed to list profile flags for account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};
