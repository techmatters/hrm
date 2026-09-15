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

// Builds a run ID from the given timestamp, so it stays deterministic in tests.
export const buildRunId = (now: Date): string =>
  `icarol-${now.toISOString().replace(/[:.]/g, '-')}`;

export type AuditLogOutcome =
  | 'created'
  | 'already-imported'
  | 'failed'
  | 'dry-run'
  | 'deferred'
  | 'unlinked'
  | 'skipped-touched'
  | 'already-unlinked'
  | 'deleted'
  | 'skipped-changed-since-unlink';

// One entry per source record. No raw PII fields, only cross-reference ids.
export type AuditLogEntry = {
  runId: string;
  callReportNum?: string;
  timestamp: string;
  outcome: AuditLogOutcome;
  failureReason?: string;
  valueWarnings?: string[];
  usedSyntheticWorker?: boolean;
  contactId?: string;
  callerNums?: string[];
  caseId?: string;
  contactIds?: string[];
  reason?: string;
};

export const buildAuditLogEntry = ({
  runId,
  callReportNum,
  timestamp,
  outcome,
  failureReason,
  valueWarnings,
  usedSyntheticWorker,
  contactId,
  callerNums,
  caseId,
  contactIds,
  reason,
}: {
  runId: string;
  callReportNum?: string;
  timestamp: Date;
  outcome: AuditLogOutcome;
  failureReason?: string;
  valueWarnings?: string[];
  usedSyntheticWorker?: boolean;
  contactId?: string;
  callerNums?: string[];
  caseId?: string;
  contactIds?: string[];
  reason?: string;
}): AuditLogEntry => ({
  runId,
  ...(callReportNum ? { callReportNum } : {}),
  timestamp: timestamp.toISOString(),
  outcome,
  ...(failureReason ? { failureReason } : {}),
  ...(valueWarnings && valueWarnings.length > 0 ? { valueWarnings } : {}),
  ...(usedSyntheticWorker ? { usedSyntheticWorker } : {}),
  ...(contactId ? { contactId } : {}),
  ...(callerNums && callerNums.length > 0 ? { callerNums } : {}),
  ...(caseId ? { caseId } : {}),
  ...(contactIds && contactIds.length > 0 ? { contactIds } : {}),
  ...(reason ? { reason } : {}),
});

// Newline-delimited JSON, one object per line.
export const formatAuditLogLines = (entries: AuditLogEntry[]): string =>
  entries.map(entry => JSON.stringify(entry)).join('\n');
