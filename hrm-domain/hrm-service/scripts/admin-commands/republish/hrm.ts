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
import { getAdminV0URL, staticKeyPattern } from '../../hrmInternalConfig';

export const command = 'hrm';
export const describe = 'Republish contacts to the data lake based on date range';

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
  f: {
    alias: 'dateFrom',
    describe: 'start date (e.g. 2024-01-01)',
    demandOption: true,
    type: 'string',
  },
  t: {
    alias: 'dateTo',
    describe: 'end date (e.g. 2024-12-31)',
    demandOption: true,
    type: 'string',
  },
};

export const handler = async ({ region, environment, accountSid, dateFrom, dateTo }) => {
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

    const url = getAdminV0URL(internalResourcesUrl, accountSid, '/contacts/reindex');
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
        `Failed to submit request for republishing contacts: ${response.statusText}`,
      );
    } else {
      console.log(`Republishing contacts from ${dateFrom} to ${dateTo}...`);
      console.log(await response.text());
    }

  } catch (err) {
    console.error(err);
  }
};
