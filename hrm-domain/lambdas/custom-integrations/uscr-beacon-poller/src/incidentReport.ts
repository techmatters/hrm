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

import { accountSid } from './config';

const hrmHeaders = {
  Authorization: `Basic ${process.env.STATIC_KEY}`,
  'Content-Type': 'application/json',
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

export const addIncidentReportToAseloCase = async ({
  updated_at: lastUpdated,
  case_id: caseId,
  id: incidentReportId,
  contact_id: contactId,
  ...restOfIncident
}: IncidentReport): Promise<string> => {
  console.debug(
    `Start processing incident report: ${incidentReportId} (last updated: ${lastUpdated})`,
  );
  if (!caseId) {
    console.warn(
      `Incident reports not already assigned to a case are not currently supported - rejecting incident report ${incidentReportId} (last updated: ${lastUpdated})`,
    );
    return lastUpdated;
  }

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
  if (newSectionResponse.ok) {
    const newSection: any = await newSectionResponse.json();
    console.debug(`Added new incidentReport case section to case ${caseId}:`, newSection);
  } else if (newSectionResponse.status === 409) {
    console.warn(
      `Incident report ${incidentReportId} was already added to case ${caseId} - overwrites are not supported.`,
      await newSectionResponse.text(),
    );
  } else {
    console.error(
      `Error adding incident report ${incidentReportId} to case ${caseId} (status ${newSectionResponse.status}):`,
      await newSectionResponse.text(),
    );
  }
  return lastUpdated;
};
