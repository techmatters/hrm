/**
 * Copyright (C) 2021-2026 Technology Matters
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

import { BeaconDocumentProcessor, NewCaseSectionInfo } from '../../types';
import { addSectionToAseloCase, updateAseloCaseOverview } from '../../caseUpdater';
import { isErr, isOk, newErr } from '@tech-matters/types';

export type IncidentReport = {
  id: number;
  number: number;
  class: string;
  priority: string;
  case_id: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
};

export const incidentReportToCaseSection = ({
  id,
  number,
  case_id,
  updated_at,
  created_at,
}: IncidentReport): NewCaseSectionInfo => {
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        beaconIncidentId: id.toString(),
        incidentNumber: number?.toString(),
        incidentCreationTimestamp: created_at,
      },
    },
  };
};

export const createIncidentReportProcessor = (
  accountSid: string,
): BeaconDocumentProcessor<IncidentReport> => {
  const addIncidentReportSectionToAseloCase = addSectionToAseloCase(
    'incidentReport',
    incidentReportToCaseSection,
    accountSid,
  );

  return async (incidentReport: IncidentReport, lastSeen: string) => {
    const incidentReportResult = await addIncidentReportSectionToAseloCase(
      incidentReport,
      lastSeen,
    );

    if (isOk(incidentReportResult)) {
      const overviewPatchResult = await updateAseloCaseOverview(
        incidentReport.case_id!,
        {
          operatingArea: incidentReport.class,
          priority: incidentReport.priority,
        },
        accountSid,
      );
      if (isErr(overviewPatchResult)) {
        return newErr({
          message: 'Failed to add responders from incident report to Aselo case',
          error: {
            type: overviewPatchResult.error.type,
            level: overviewPatchResult.error.level,
            lastUpdated: incidentReportResult.unwrap(),
          },
        });
      }
    }

    return incidentReportResult;
  };
};
