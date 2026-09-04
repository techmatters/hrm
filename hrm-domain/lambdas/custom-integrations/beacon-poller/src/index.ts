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

import { BEACON_API_KEY_HEADER } from './config';
import { readApiInChunks } from './apiChunkReader';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import type { AccountSID } from '@tech-matters/types';
import { createBeaconDocumentProcessor } from './beaconDocumentProcessors';

const environment = process.env.NODE_ENV!;

const accountSidParamPath = (helplineShortCode: string): string =>
  `/${environment}/twilio/${helplineShortCode.toUpperCase()}/account_sid`;

export const handler = async ({
  apiType,
  helplineShortCode,
}: {
  apiType: 'incidentReport' | 'caseReport';
  helplineShortCode: 'uscr' | 'gy' | 'as';
}): Promise<0 | -1> => {
  let accountSid: AccountSID;
  let beaconBaseUrl: string;
  let beaconApiKey: string;
  try {
    [accountSid, beaconBaseUrl, beaconApiKey] = (await Promise.all([
      getSsmParameter(accountSidParamPath(helplineShortCode)),
      getSsmParameter(
        `/${environment}/hrm/custom-integration/${helplineShortCode.toLowerCase()}/beacon_base_url`,
      ),
      getSsmParameter(
        `/${environment}/hrm/custom-integration/${helplineShortCode.toLowerCase()}/beacon_api_key`,
      ),
    ])) as [AccountSID, string, string];
  } catch (err) {
    console.error(
      `[beacon-poller] Could not look up required parameters for helpline '${helplineShortCode}' from SSM path ${accountSidParamPath(
        helplineShortCode,
      )}. Abandoning run.`,
      err,
    );
    return -1;
  }

  const beaconHeaders = { [BEACON_API_KEY_HEADER]: beaconApiKey };
  const lastUpdateSeenSsmKey = `/${environment}/hrm/custom-integration/beacon/${accountSid}/${apiType}/latest_seen`;
  const configDefaults = {
    headers: beaconHeaders,
    lastUpdateSeenSsmKey,
    maxItemsInChunk: parseInt(
      (apiType === 'incidentReport'
        ? process.env.MAX_INCIDENT_REPORTS_PER_CALL
        : process.env.MAX_CASE_REPORTS_PER_CALL) || '1000',
    ),
    maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
    itemProcessor: createBeaconDocumentProcessor(helplineShortCode, apiType, accountSid),
  };
  const beaconApiName = apiType === 'incidentReport' ? 'incidents' : 'case_reports';
  const apiPollConfig = {
    ...configDefaults,
    url: new URL(`${beaconBaseUrl}/api/aselo/${beaconApiName}/updates`),
    itemExtractor: (body: any) => body[beaconApiName],
    itemTypeName: apiType === 'incidentReport' ? 'incident report' : 'case report',
  } as const;

  console.info(
    `[TRACER][${apiPollConfig.itemTypeName}][${helplineShortCode}] Starting beacon poll: `,
    helplineShortCode,
    apiType,
  );
  await readApiInChunks<any>(apiPollConfig);
  console.info(
    `[TRACER][${apiPollConfig.itemTypeName}][${helplineShortCode}] Completed beacon poll: `,
    helplineShortCode,
    apiType,
  );

  return 0;
};
