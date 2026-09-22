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
import { buildAuditLogEntry, buildRunId, formatAuditLogLines } from './runAudit';

describe('buildRunId', () => {
  test('builds a deterministic, filesystem/key-safe ID from the given timestamp', () => {
    expect(buildRunId(new Date('2026-09-02T18:30:00.123Z'))).toBe(
      'icarol-2026-09-02T18-30-00-123Z',
    );
  });
});

describe('buildAuditLogEntry', () => {
  test('omits failureReason and valueWarnings when not provided', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
      }),
    ).toEqual({
      runId: 'icarol-run-1',
      callReportNum: '12345',
      timestamp: '2026-09-02T18:30:00.000Z',
      outcome: 'created',
    });
  });

  test('includes failureReason when the record failed', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'failed',
        failureReason: 'HTTP 500',
      }),
    ).toMatchObject({ outcome: 'failed', failureReason: 'HTTP 500' });
  });

  test('includes valueWarnings when present, omits when empty', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        valueWarnings: ['race: Martian'],
      }),
    ).toMatchObject({ valueWarnings: ['race: Martian'] });

    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        valueWarnings: [],
      }),
    ).not.toHaveProperty('valueWarnings');
  });

  test('includes usedSyntheticWorker when true, omits when false', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        usedSyntheticWorker: true,
      }),
    ).toMatchObject({ usedSyntheticWorker: true });

    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        usedSyntheticWorker: false,
      }),
    ).not.toHaveProperty('usedSyntheticWorker');
  });

  test('includes contactId when present, omits when not (needed to resolve taskId to a real Contact id)', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        contactId: 'abc-123',
      }),
    ).toMatchObject({ contactId: 'abc-123' });

    expect(
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '12345',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
      }),
    ).not.toHaveProperty('contactId');
  });

  test('omits callReportNum when not present (a case entry has no single call report)', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-cases-run-1',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
        callerNums: ['100', '200'],
        caseId: 'case-abc',
        contactIds: ['contact-1', 'contact-2'],
      }),
    ).toEqual({
      runId: 'icarol-cases-run-1',
      timestamp: '2026-09-02T18:30:00.000Z',
      outcome: 'created',
      callerNums: ['100', '200'],
      caseId: 'case-abc',
      contactIds: ['contact-1', 'contact-2'],
    });
  });

  test('includes callerNums/caseId/contactIds/reason when present, omits when not', () => {
    expect(
      buildAuditLogEntry({
        runId: 'icarol-cases-run-1',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'skipped-touched',
        reason: 'updatedBy no longer the system identity',
      }),
    ).toMatchObject({
      outcome: 'skipped-touched',
      reason: 'updatedBy no longer the system identity',
    });

    const bare = buildAuditLogEntry({
      runId: 'icarol-cases-run-1',
      timestamp: new Date('2026-09-02T18:30:00.000Z'),
      outcome: 'deferred',
    });
    expect(bare).not.toHaveProperty('callerNums');
    expect(bare).not.toHaveProperty('caseId');
    expect(bare).not.toHaveProperty('contactIds');
    expect(bare).not.toHaveProperty('reason');
  });
});

describe('formatAuditLogLines', () => {
  test('returns an empty string for no entries', () => {
    expect(formatAuditLogLines([])).toBe('');
  });

  test('joins entries as one JSON object per line', () => {
    const entries = [
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '1',
        timestamp: new Date('2026-09-02T18:30:00.000Z'),
        outcome: 'created',
      }),
      buildAuditLogEntry({
        runId: 'icarol-run-1',
        callReportNum: '2',
        timestamp: new Date('2026-09-02T18:30:01.000Z'),
        outcome: 'failed',
        failureReason: 'HTTP 500',
      }),
    ];

    const lines = formatAuditLogLines(entries).split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      callReportNum: '1',
      outcome: 'created',
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      callReportNum: '2',
      outcome: 'failed',
      failureReason: 'HTTP 500',
    });
  });
});
