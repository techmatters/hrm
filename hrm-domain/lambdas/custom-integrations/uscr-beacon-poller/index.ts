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
  // Read the last update seen from SSM
  const lastUpdateSeen = getSsmParameter(lastUpdateSeenSsmKey);
  console.debug('Last beacon update seen:', lastUpdateSeen);
  // Do something on the public internet
  const response = await fetch('https://google.com');
  console.info('External API responded with status:', response.status);
  // Do something on the internal HRM API
  const hrmResponse = await fetch(
    `${process.env.INTERNAL_HRM_URL}/v0/accounts/${accountSid}/profiles/identifier/1234/flags`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${staticKey}`,
      },
    },
  );
  console.info('HRM API responded with status:', hrmResponse.status);
  // Update the last update seen in SSM
  await putSsmParameter(lastUpdateSeenSsmKey, new Date().toISOString(), {
    overwrite: true,
  });
  console.info('HRM API responded with status:', hrmResponse.status);

  return 0;
};
