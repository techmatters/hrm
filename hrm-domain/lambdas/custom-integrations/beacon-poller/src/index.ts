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

import { createIncidentReportProcessor } from './incidentReport';
import { BEACON_API_KEY_HEADER } from './config';
import { readApiInChunks } from './apiChunkReader';
import { createCaseReportProcessor } from './caseReport';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import type { AccountSID } from '@tech-matters/types';

const environment = process.env.NODE_ENV!;

const accountSidParamPath = (helplineShortCode: string): string =>
  `/${environment}/twilio/${helplineShortCode.toUpperCase()}/account_sid`;

export const handler = async ({
  apiType,
  helplineShortCode,
}: {
  apiType: 'incidentReport' | 'caseReport';
  helplineShortCode: string;
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

  const lastIncidentReportUpdateSeenSsmKey = `/${environment}/hrm/custom-integration/beacon/${accountSid}/latest_incident_report_seen`;
  const lastCaseReportUpdateSeenSsmKey = `/${environment}/hrm/custom-integration/beacon/${accountSid}/latest_case_report_seen`;

  const API_POLL_CONFIGS = {
    caseReport: {
      url: new URL(`${beaconBaseUrl}/api/aselo/case_reports/updates`),
      headers: beaconHeaders,
      lastUpdateSeenSsmKey: lastCaseReportUpdateSeenSsmKey,
      itemExtractor: (body: any) => body.case_reports,
      itemProcessor: createCaseReportProcessor(accountSid),
      maxItemsInChunk: parseInt(process.env.MAX_CASE_REPORTS_PER_CALL || '1000'),
      maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'case report',
    },
    incidentReport: {
      url: new URL(`${beaconBaseUrl}/api/aselo/incidents/updates`),
      headers: beaconHeaders,
      lastUpdateSeenSsmKey: lastIncidentReportUpdateSeenSsmKey,
      itemExtractor: (body: any) => body.incidents,
      itemProcessor: createIncidentReportProcessor(accountSid),
      maxItemsInChunk: parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000'),
      maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'incident report',
    },
  } as const;

  console.info(
    `[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName}][${helplineShortCode}] Starting beacon poll: `,
    apiType,
  );
  await readApiInChunks<any>(API_POLL_CONFIGS[apiType]);
  console.info(
    `[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName}][${helplineShortCode}] Completed beacon poll: `,
    apiType,
  );

  return 0;
};
