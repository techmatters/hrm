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

import { incidentReportToCaseSection } from './incidentReport';
import { accountSid, beaconHeaders } from './config';
import { readApiInChunks } from './apiChunkReader';
import { addSectionToAseloCase } from './caseUpdater';
import { addCaseReportSectionsToAseloCase } from './caseReport';

const lastIncidentReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/beacon/latest_incident_report_seen`;
const lastCaseReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${accountSid}/beacon/latest_case_report_seen`;

export const handler = async ({
  apiType,
}: {
  apiType: 'incidentReport' | 'caseReport';
}): Promise<0> => {
  const API_POLL_CONFIGS = {
    caseReport: {
      url: new URL(`${process.env.BEACON_BASE_URL}/api/aselo/casereports/updates`),
      headers: beaconHeaders,
      lastUpdateSeenSsmKey: lastCaseReportUpdateSeenSsmKey,
      itemExtractor: (body: any) => body.casereports,
      itemProcessor: addCaseReportSectionsToAseloCase,
      maxItemsInChunk: parseInt(process.env.MAX_CASE_REPORTS_PER_CALL || '1000'),
      maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'case report',
    },
    incidentReport: {
      url: new URL(`${process.env.BEACON_BASE_URL}/api/aselo/incidents/updates`),
      headers: beaconHeaders,
      lastUpdateSeenSsmKey: lastIncidentReportUpdateSeenSsmKey,
      itemExtractor: (body: any) => body.incidents,
      itemProcessor: addSectionToAseloCase('incidentReport', incidentReportToCaseSection),
      maxItemsInChunk: parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000'),
      maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
      itemTypeName: 'incident report',
    },
  } as const;
  console.info(
    `[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName}] Starting beacon poll: `,
    apiType,
  );
  await readApiInChunks<any>(API_POLL_CONFIGS[apiType]);
  console.info(
    `[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName} Completed beacon poll: `,
    apiType,
  );
  return 0;
};
