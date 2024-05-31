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

export const command = 'create';
export const describe =
  'Create an identifier (if not exists) and a new profile associated to it';
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
  i: {
    alias: 'identifier',
    describe: 'the identifier',
    demandOption: true,
    type: 'string',
  },
  n: {
    alias: 'name',
    describe: 'the name for the new profile',
    demandOption: false,
    type: 'string',
  },
};

export const handler = async ({ region, environment, accountSid, identifier, name }) => {
  try {
    const timestamp = new Date().getTime();
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
      RoleSessionName: `hrm-admin-cli-${timestamp}`,
    };

    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      staticKeyPattern,
      assumeRoleParams,
    });

    const url = getAdminV0URL(internalResourcesUrl, accountSid, '/profiles/identifiers');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authKey}`,
      },
      body: JSON.stringify({ identifier, name }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit request: ${response.statusText}`);
    }

    const jsonResp = await response.json();
    console.log(JSON.stringify(jsonResp, null, 2));
  } catch (err) {
    console.error(
      `Failed to create identifier ${identifier} account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};
