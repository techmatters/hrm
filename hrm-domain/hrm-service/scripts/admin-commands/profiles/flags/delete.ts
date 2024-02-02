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
// eslint-disable-next-line import/no-extraneous-dependencies
import { fetch } from 'undici';
import { getAdminV0URL, staticKeyPattern } from '../../../hrmInternalConfig';

export const command = 'delete';
export const describe = 'Delete an existing profile flag';
export const builder = {
  e: {
    alias: 'environment',
    describe: 'environment, defaults to development',
    type: 'string',
    default: 'development',
  },
  r: {
    alias: 'region',
    describe: 'region, defaults to us-east-1',
    type: 'string',
    default: 'us-east-1',
  },
  a: {
    alias: 'accountSid',
    describe: 'account SID',
    demandOption: true,
    type: 'string',
  },
  i: {
    alias: 'flagId',
    describe: 'the id of the flag to delete',
    demandOption: true,
    type: 'number',
  },
};

export const handler = async ({ region, environment, accountSid, flagId }) => {
  try {
    const timestamp = new Date().getTime();
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/admin-no-pii',
      RoleSessionName: `hrm-admin-cli-${timestamp}`,
    };

    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      staticKeyPattern,
      assumeRoleParams,
    });

    const url = getAdminV0URL(
      internalResourcesUrl,
      accountSid,
      `/profiles/flags/${flagId}`,
    );

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to submit request: ${response.statusText}`);
    }

    const jsonResp = await response.json();
    console.log(JSON.stringify(jsonResp, null, 2));
  } catch (err) {
    console.error(
      `Failed to delete profile flag ${flagId} for account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};
