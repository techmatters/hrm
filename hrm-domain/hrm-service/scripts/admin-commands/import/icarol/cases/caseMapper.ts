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
import type { CaseRecordCommon } from '@tech-matters/hrm-types';
import type { CaseCandidate } from './caseIdentityResolution';

const USNC_DEFINITION_VERSION = 'usnc-v1';

/**
 * Maps a CaseCandidate to the body for `POST /cases`. `createdBy`/
 * `twilioWorkerId` are left unset — no source field maps to case ownership.
 */
export const mapCase = (candidate: CaseCandidate): Partial<CaseRecordCommon> => {
  const info: Record<string, string> = { definitionVersion: USNC_DEFINITION_VERSION };
  if (candidate.linkedProfileName) info.linkedProfileName = candidate.linkedProfileName;
  if (candidate.summary) info.summary = candidate.summary;

  return {
    label: candidate.label,
    status: 'open',
    definitionVersion: USNC_DEFINITION_VERSION,
    info,
  };
};
