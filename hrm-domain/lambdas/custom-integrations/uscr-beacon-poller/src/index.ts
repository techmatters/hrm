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

import { getSsmParameter, putSsmParameter } from '@tech-matters/ssm-cache';

const accountSid = process.env.ACCOUNT_SID;
const staticKey = process.env.STATIC_KEY;
const lastUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/latest_beacon_update_seen`;

export const handler = async (): Promise<0> => {
  const maxIncidents = parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000');
  // Read the last update seen from SSM
  const lastUpdateSeen = await getSsmParameter(lastUpdateSeenSsmKey);
  console.info('Last beacon update before:', lastUpdateSeen);
  // Query Beacon API
  const url = `${process.env.BEACON_URL}?updatedAfter=${lastUpdateSeen}&max=${maxIncidents}`;
  console.info('Querying:', url);
  const response = await fetch(url);
  console.debug(
    'External API responded with status:',
    response.status,
    await response.text(),
  );
  // Do something on the internal HRM API - will return a 404
  const hrmResponse = await fetch(
    `${process.env.INTERNAL_HRM_URL}/v0/accounts/${accountSid}/profiles/identifier/1234/flags`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${staticKey}`,
      },
    },
  );
  console.debug(
    'HRM API responded with status:',
    hrmResponse.status,
    await hrmResponse.text(),
  );
  // Update the last update seen in SSM
  await putSsmParameter(lastUpdateSeenSsmKey, new Date().toISOString(), {
    overwrite: true,
  });
  console.info('Last beacon update after:', await getSsmParameter(lastUpdateSeenSsmKey));

  return 0;
};
