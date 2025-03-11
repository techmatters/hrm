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
export const BEACON_API_KEY_HEADER = 'X-API-Token';
const hrmHeaders = {
  Authorization: `Basic ${process.env.STATIC_KEY}`,
  'Content-Type': 'application/json',
};
const beaconHeaders = {
  [BEACON_API_KEY_HEADER]: process.env.BEACON_API_KEY!,
};
const lastIncidentReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/beacon/latest_incident_report_seen`;
const lastCaseReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/beacon/latest_case_report_seen`;

type PollConfig<TItem> = {
  url: URL;
  lastUpdateSeenSsmKey: string;
  itemProcessor: (item: TItem) => Promise<string>;
  maxIncidents: number;
  maxConsecutiveApiCalls: number;
  itemTypeName?: string; // Just for logging
};

export type IncidentReport = {
  id: number;
  case_id: number;
  contact_id: string;
  description: string;
  address: string;
  category_id: number;
  incident_class_id: number;
  status: string;
  caller_name: string;
  caller_number: string;
  created_at: string;
  updated_at: string;
};

const processIncidentReport = async ({
  updated_at: lastUpdated,
  case_id: caseId,
  id: incidentReportId,
  contact_id: contactId,
  ...restOfIncident
}: IncidentReport): Promise<string> => {
  console.debug('Start processing incident report:', lastUpdated);
  // Do something on the internal HRM API - will return a 404

  const newSectionResponse = await fetch(
    `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/incidentReport`,
    {
      method: 'POST',
      body: JSON.stringify({
        sectionId: incidentReportId,
        sectionTypeSpecificData: restOfIncident,
      }),
      headers: hrmHeaders,
    },
  );
  const newSection: any = await newSectionResponse.json();
  console.debug(`Added new incidentReport case section to case ${caseId}:`, newSection);
  return lastUpdated;
};

const processBatch = async <TItem>(
  items: TItem[],
  lastSeen: string,
  itemProcessor: (item: TItem) => Promise<string>,
  itemTypeName: string = 'item',
): Promise<string> => {
  let updatedLastSeen = lastSeen;
  try {
    for (const item of items) {
      console.debug(`Start processing ${itemTypeName}:`, lastSeen);
      // Do something on the internal HRM API - will return a 404
      updatedLastSeen = await itemProcessor(item);
    }
  } catch (error) {
    console.error(`Error processing ${itemTypeName}, abandoning batch:`, error);
  }
  return updatedLastSeen;
};

const pollApi = async <TItem>({
  url,
  lastUpdateSeenSsmKey,
  maxIncidents,
  maxConsecutiveApiCalls,
  itemProcessor,
  itemTypeName = 'item',
}: PollConfig<TItem>) => {
  let lastUpdateSeen = await getSsmParameter(lastUpdateSeenSsmKey);
  let processedAllIncidents = false;
  for (let i = 0; i < maxConsecutiveApiCalls; i++) {
    console.info(`Last ${itemTypeName} update before:`, lastUpdateSeen);
    // Query Beacon API
    url.searchParams.set('updatedAfter', lastUpdateSeen);
    url.searchParams.set('max', maxIncidents.toString());
    console.info('Querying:', url);
    const response = await fetch(url, { headers: beaconHeaders });
    console.debug(`Beacon ${itemTypeName} API responded with status:`, response.status);
    if (response.ok) {
      const beaconData = (await response.json()) as TItem[];
      if (!Array.isArray(beaconData)) {
        throw new Error(
          `Beacon ${itemTypeName} API did not return a valid response: ${JSON.stringify(
            beaconData,
          )}`,
        );
      }
      console.info(`Received ${beaconData.length} new ${itemTypeName}s from Beacon`);
      if (beaconData.length === 0) {
        console.info(`No new ${itemTypeName} found querying after:`, lastUpdateSeen);
        processedAllIncidents = true;
        return;
      }
      lastUpdateSeen = await processBatch<TItem>(
        beaconData,
        lastUpdateSeen,
        itemProcessor,
      );
      // Update the last update seen in SSM
      await putSsmParameter(lastUpdateSeenSsmKey, lastUpdateSeen);
      console.info(
        'Last beacon update after:',
        await getSsmParameter(lastUpdateSeenSsmKey),
      );
      if (beaconData.length < maxIncidents) {
        console.info(
          `Only ${beaconData.length} ${itemTypeName} in latest batch, less than the maximum of ${maxIncidents}`,
          lastUpdateSeen,
        );
        processedAllIncidents = true;
        return;
      }
    }
  }
  if (!processedAllIncidents) {
    console.warn(
      `Beacon poll queries the API the maximum of ${maxConsecutiveApiCalls} times and still doesn't appear to have processed all ${itemTypeName}s. This could indicate an issue with the API or the client, or the settings may have to be adjusted to keep up with the volume of incidents.`,
    );
  }
};

export const handler = async ({
  api,
}: {
  api: 'incidentReport' | 'caseReport';
}): Promise<0> => {
  const API_POLL_CONFIGS = {
    incidentReport: {
      url: new URL(`${process.env.BEACON_BASE_URL}/incidentReport`),
      lastUpdateSeenSsmKey: lastIncidentReportUpdateSeenSsmKey,
      itemProcessor: processIncidentReport,
      maxIncidents: parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000'),
      maxConsecutiveApiCalls: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'incident report',
    },
    caseReport: {
      url: new URL(`${process.env.BEACON_BASE_URL}/caseReport`),
      lastUpdateSeenSsmKey: lastCaseReportUpdateSeenSsmKey,
      itemProcessor: processIncidentReport,
      maxIncidents: parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000'),
      maxConsecutiveApiCalls: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'case report',
    },
  } as const;

  await pollApi(API_POLL_CONFIGS[api]);
  return 0;
};
