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
const hrmHeaders = {
  Authorization: `Basic ${process.env.STATIC_KEY}`,
  'Content-Type': 'application/json',
};
const lastUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/latest_beacon_update_seen`;

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

const processIncidentReportBatch = async (
  incidents: IncidentReport[],
  lastSeen: string,
): Promise<string> => {
  let updatedLastSeen = lastSeen;
  try {
    for (const {
      updated_at: lastUpdated,
      case_id: caseId,
      id: incidentReportId,
      contact_id: contactId,
      ...restOfIncident
    } of incidents) {
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
      console.debug(`Added new case section to case ${caseId}:`, newSection);
      updatedLastSeen = lastUpdated;
    }
  } catch (error) {
    console.error('Error processing incident report, abandoning batch:', error);
  }
  return updatedLastSeen;
};

export const handler = async (): Promise<0> => {
  // Evaluated per call so they can be changed in place if necessary
  const maxIncidents = parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000');
  const maxConsecutiveApiCalls = parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10');
  // Read the last update seen from SSM
  let lastUpdateSeen = await getSsmParameter(lastUpdateSeenSsmKey);
  let processedAllIncidents = false;
  for (let i = 0; i < maxConsecutiveApiCalls; i++) {
    console.info('Last beacon update before:', lastUpdateSeen);
    // Query Beacon API
    const url = `${process.env.BEACON_URL}?updatedAfter=${lastUpdateSeen}&max=${maxIncidents}`;
    console.info('Querying:', url);
    const response = await fetch(url);
    console.debug('Beacon API responded with status:', response.status);
    if (response.ok) {
      const beaconData = (await response.json()) as IncidentReport[];
      if (!Array.isArray(beaconData)) {
        throw new Error(
          `Beacon API did not return a valid response: ${JSON.stringify(beaconData)}`,
        );
      }
      console.info('Received beacon data:', beaconData);
      if (beaconData.length === 0) {
        console.info('No new incidents found querying after:', lastUpdateSeen);
        processedAllIncidents = true;
        break;
      }
      lastUpdateSeen = await processIncidentReportBatch(beaconData, lastUpdateSeen);
      // Update the last update seen in SSM
      await putSsmParameter(lastUpdateSeenSsmKey, lastUpdateSeen);
      console.info(
        'Last beacon update after:',
        await getSsmParameter(lastUpdateSeenSsmKey),
      );
      if (beaconData.length < maxIncidents) {
        console.info(
          `Only ${beaconData.length} incidents in latest batch, less than the maximum of ${maxIncidents}`,
          lastUpdateSeen,
        );
        processedAllIncidents = true;
        break;
      }
    }
  }
  if (!processedAllIncidents) {
    console.warn(
      `Beacon poll queries the API the maximum of ${maxConsecutiveApiCalls} times and still doesn't appear to have processed all incidents. This could indicate an issue with the API or the client, or the settings may have to be adjusted to keep up with the volume of incidents.`,
    );
  }
  return 0;
};
