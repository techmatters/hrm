/* eslint-disable @typescript-eslint/naming-convention */
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
import { addSectionToAseloCase, updateAseloCaseStatus } from '../../caseUpdater';
import { isErr, isOk, newErr } from '@tech-matters/types';
import { CaseReportContentNode } from '../extractContentNodeValues';

type RelevantRawCaseReportApiPayload = {
  id: number;
  case_id: string | null;
  incident_id: number;
  created_at: string;
  updated_at: string;
  content: {
    fields: CaseReportContentNode[];
  };
};

const caseReportToCaseReportCaseSection = ({
  id,
  case_id,
  updated_at,
}: RelevantRawCaseReportApiPayload): NewCaseSectionInfo => {
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {},
    },
  };
};

export type RawCaseReportApiPayload = RelevantRawCaseReportApiPayload &
  Omit<Record<string, any>, keyof RelevantRawCaseReportApiPayload>;

export const createCaseReportProcessor = (
  accountSid: string,
): BeaconDocumentProcessor<RawCaseReportApiPayload> => {
  const addCaseReportSectionToAseloCase = addSectionToAseloCase(
    'caseReport',
    caseReportToCaseReportCaseSection,
    accountSid,
  );

  return async (caseReport: RawCaseReportApiPayload, lastSeen: string) => {
    const caseReportResult = await addCaseReportSectionToAseloCase(caseReport, lastSeen);
    if (isOk(caseReportResult)) {
      const caseStatusUpdateResult = await updateAseloCaseStatus(
        caseReport.case_id!,
        'open',
        accountSid,
      );
      if (isErr(caseStatusUpdateResult)) {
        return newErr({
          message: 'Failed to update status for Aselo case',
          error: {
            type: caseStatusUpdateResult.error.type,
            level: caseStatusUpdateResult.error.level,
            lastUpdated: caseReportResult.unwrap(),
          },
        });
      }
    }
    return caseReportResult;
  };
};
