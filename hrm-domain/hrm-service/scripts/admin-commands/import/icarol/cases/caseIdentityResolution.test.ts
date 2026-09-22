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
import {
  ICarolCallReportRecord,
  ICarolRepeatCallerRecord,
  buildCaseCandidates,
  distinctPhoneNumbers,
  qualifyingIdentityGroups,
  resolveCaseLabel,
  resolveIdentityGroups,
} from './caseIdentityResolution';

const buildCallReport = (
  overrides: Partial<ICarolCallReportRecord> = {},
): ICarolCallReportRecord => ({
  CallReportNum: '1',
  CallerNum: '100',
  CallerName: 'Jane Doe',
  PhoneNumberFull: '5551234567',
  CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const buildRepeatCaller = (
  overrides: Partial<ICarolRepeatCallerRecord> = {},
): ICarolRepeatCallerRecord => ({
  CallerNum: '100',
  Alias: '',
  History: '',
  ...overrides,
});

describe('distinctPhoneNumbers', () => {
  test('excludes blank phone numbers from the count', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '' }),
      buildCallReport({ PhoneNumberFull: '   ' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('deduplicates repeated phone numbers', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '5551111111' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('treats the same number as one, regardless of surrounding whitespace', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: ' 5551111111 ' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('treats the same number as one, regardless of punctuation formatting', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '(555) 111-1111' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('excludes a value that has no digits at all once normalized', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '---' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('treats a +1 NANP country code prefix as the same number', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '+1 (555) 111-1111' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });

  test('treats a 1-prefixed dashed spelling as the same number', () => {
    const records = [
      buildCallReport({ PhoneNumberFull: '5551111111' }),
      buildCallReport({ PhoneNumberFull: '1-555-111-1111' }),
    ];
    expect(distinctPhoneNumbers(records)).toEqual(['5551111111']);
  });
});

describe('resolveIdentityGroups', () => {
  test('keeps a CallerNum with no matching Repeat Callers row as its own solo group', () => {
    const groups = resolveIdentityGroups(['100'], []);
    expect(groups).toEqual([['100']]);
  });

  test('keeps a CallerNum with a blank Alias as its own solo group', () => {
    const repeatCallers = [buildRepeatCaller({ CallerNum: '100', Alias: '' })];
    expect(resolveIdentityGroups(['100'], repeatCallers)).toEqual([['100']]);
  });

  test('keeps a CallerNum with a placeholder-style Alias as its own solo group when unmatched', () => {
    const repeatCallers = [buildRepeatCaller({ CallerNum: '100', Alias: 'Anon1234' })];
    expect(resolveIdentityGroups(['100'], repeatCallers)).toEqual([['100']]);
  });

  test('merges two CallerNums that share the same placeholder-style Alias', () => {
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Anon1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Anon1234' }),
    ];
    const groups = resolveIdentityGroups(['100', '200'], repeatCallers);
    expect(groups).toEqual([['100', '200']]);
  });

  test('does not merge two CallerNums with different placeholder-style Aliases', () => {
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Anon1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Anon5678' }),
    ];
    const groups = resolveIdentityGroups(['100', '200'], repeatCallers);
    expect(groups).toHaveLength(2);
  });

  test('merges two CallerNums that share the same real Alias', () => {
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Janey1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Janey1234' }),
    ];
    const groups = resolveIdentityGroups(['100', '200'], repeatCallers);
    expect(groups).toEqual([['100', '200']]);
  });

  test('matches Alias case-insensitively and trims whitespace when merging', () => {
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Janey1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: '  janey1234  ' }),
    ];
    const groups = resolveIdentityGroups(['100', '200'], repeatCallers);
    expect(groups).toEqual([['100', '200']]);
  });

  test('keeps unrelated CallerNums with different real Aliases as separate groups', () => {
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Janey1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Bobby5678' }),
    ];
    const groups = resolveIdentityGroups(['100', '200'], repeatCallers);
    expect(groups).toHaveLength(2);
  });
});

describe('qualifyingIdentityGroups', () => {
  test('excludes a CallerNum with only 1 distinct phone number', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([]);
  });

  test('includes a CallerNum with 2+ distinct phone numbers', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5552222222' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([['100']]);
  });

  test('does not manufacture a qualifying case from one number in two different formats', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '(555) 111-1111' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([]);
  });

  test('does not manufacture a qualifying case from a +1-prefixed spelling of the same number', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '+1 (555) 111-1111' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([]);
  });

  test('does not count a blank phone number toward the 2+ threshold', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([]);
  });

  test('excludes a blank CallerNum entirely, even with 2+ phone numbers', () => {
    const records = [
      buildCallReport({ CallerNum: '', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '', PhoneNumberFull: '5552222222' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([]);
  });

  test('includes a negative CallerNum like any other', () => {
    // Only a blank CallerNum is excluded; negative and zero values are ordinary identifiers.
    const records = [
      buildCallReport({ CallerNum: '-2', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '-2', PhoneNumberFull: '5552222222' }),
    ];
    expect(qualifyingIdentityGroups(records, [])).toEqual([['-2']]);
  });

  test('qualifies a merged group even when no single member has 2+ numbers on its own', () => {
    // The whole point of merging by Alias: two CallerNums, one phone number
    // each, but the same real person per the shared Alias.
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '200', PhoneNumberFull: '5552222222' }),
    ];
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Janey1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Janey1234' }),
    ];
    const groups = qualifyingIdentityGroups(records, repeatCallers);
    expect(groups).toEqual([['100', '200']]);
  });

  test('qualifies a merged group via a shared placeholder-style Alias, same as a real name', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '200', PhoneNumberFull: '5552222222' }),
    ];
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Anon1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Anon1234' }),
    ];
    expect(qualifyingIdentityGroups(records, repeatCallers)).toEqual([['100', '200']]);
  });

  test('does NOT merge two CallerNums with different placeholder-style Aliases into a false qualification', () => {
    const records = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '200', PhoneNumberFull: '5552222222' }),
    ];
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Anon1234' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Anon5678' }),
    ];
    expect(qualifyingIdentityGroups(records, repeatCallers)).toEqual([]);
  });
});

describe('resolveCaseLabel', () => {
  test('throws on an empty record set rather than silently returning undefined', () => {
    expect(() => resolveCaseLabel([])).toThrow();
  });

  test('trims the winning spelling, even when the padded form is the most frequent one', () => {
    const records = [
      buildCallReport({ CallerName: 'Jane Doe ' }),
      buildCallReport({ CallerName: 'Jane Doe ' }),
      buildCallReport({ CallerName: 'Jane Doe' }),
    ];
    expect(resolveCaseLabel(records)).toEqual('Jane Doe');
  });

  test('returns the only name when there is no variation', () => {
    const records = [buildCallReport({ CallerName: 'Jane Doe' })];
    expect(resolveCaseLabel(records)).toEqual('Jane Doe');
  });

  test('does not let a trailing-whitespace variant split the vote and win on a tie-break', () => {
    const records = [
      buildCallReport({ CallerName: 'Jane Doe' }),
      buildCallReport({ CallerName: 'Jane Doe ' }),
      buildCallReport({ CallerName: 'Bob' }),
    ];
    expect(resolveCaseLabel(records)).toEqual('Jane Doe');
  });

  test('picks the most frequent name when names vary', () => {
    const records = [
      buildCallReport({
        CallerName: 'Jane Doe',
        CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
      }),
      buildCallReport({
        CallerName: 'Jane Doe',
        CallDateAndTimeStart: '2026-01-02T00:00:00.000Z',
      }),
      buildCallReport({
        CallerName: 'J. Doe',
        CallDateAndTimeStart: '2026-01-03T00:00:00.000Z',
      }),
    ];
    expect(resolveCaseLabel(records)).toEqual('Jane Doe');
  });

  test('breaks a frequency tie by most recent call', () => {
    const records = [
      buildCallReport({
        CallerName: 'Jane Doe',
        CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
      }),
      buildCallReport({
        CallerName: 'J. Doe',
        CallDateAndTimeStart: '2026-01-05T00:00:00.000Z',
      }),
    ];
    expect(resolveCaseLabel(records)).toEqual('J. Doe');
  });

  test('breaks a full tie (same frequency, same latest date) alphabetically', () => {
    const records = [
      buildCallReport({
        CallerName: 'Zed',
        CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
      }),
      buildCallReport({
        CallerName: 'Amy',
        CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
      }),
    ];
    expect(resolveCaseLabel(records)).toEqual('Amy');
  });
});

describe('buildCaseCandidates', () => {
  test('builds a candidate with label, linkedProfileName, summary, and every contactTaskId', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: '100',
        PhoneNumberFull: '5551111111',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: '100',
        PhoneNumberFull: '5552222222',
      }),
    ];
    const repeatCallers = [
      buildRepeatCaller({
        CallerNum: '100',
        Alias: 'Janey',
        History: 'Long-time caller',
      }),
    ];

    const candidates = buildCaseCandidates(callReports, repeatCallers);

    expect(candidates).toEqual([
      {
        callerNums: ['100'],
        label: 'Jane Doe',
        linkedProfileName: 'Janey',
        summary: 'Long-time caller',
        contactTaskIds: ['TK_legacy_1', 'TK_legacy_2'],
        distinctPhoneNumbers: ['5551111111', '5552222222'],
      },
    ]);
  });

  test('omits linkedProfileName and summary when the Repeat Callers fields are blank', () => {
    const callReports = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5552222222' }),
    ];
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: '', History: '' }),
    ];

    const [candidate] = buildCaseCandidates(callReports, repeatCallers);

    expect(candidate).not.toHaveProperty('linkedProfileName');
    expect(candidate).not.toHaveProperty('summary');
  });

  test('still builds a candidate when no matching Repeat Callers row exists at all', () => {
    // A qualifying CallerNum may have no profile row; the case is still created
    // from call data alone.
    const callReports = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5552222222' }),
    ];

    const [candidate] = buildCaseCandidates(callReports, []);

    expect(candidate.callerNums).toEqual(['100']);
    expect(candidate).not.toHaveProperty('linkedProfileName');
    expect(candidate).not.toHaveProperty('summary');
  });

  test('does not build a candidate for a CallerNum with only 1 phone number', () => {
    const callReports = [
      buildCallReport({ CallerNum: '100', PhoneNumberFull: '5551111111' }),
    ];
    expect(buildCaseCandidates(callReports, [])).toEqual([]);
  });

  test('trims a stored linkedProfileName and picks it deterministically, not by lexicographic CallerNum sort', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: '1000',
        PhoneNumberFull: '5551111111',
        CallDateAndTimeStart: '2026-01-01T00:00:00.000Z',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: '200',
        PhoneNumberFull: '5552222222',
        CallDateAndTimeStart: '2026-02-01T00:00:00.000Z',
      }),
    ];
    const repeatCallers = [
      // '1000' sorts before '200' lexicographically, but has the OLDER call --
      // picks '200's spelling (most recent), trimmed either way.
      buildRepeatCaller({ CallerNum: '1000', Alias: '  janey1234  ' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'JANEY1234' }),
    ];

    const [candidate] = buildCaseCandidates(callReports, repeatCallers);

    expect(candidate.linkedProfileName).toEqual('JANEY1234');
  });

  test('merges two CallerNums sharing a real Alias into one candidate with both taskIds', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: '100',
        CallerName: 'Jane Doe',
        PhoneNumberFull: '5551111111',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: '200',
        CallerName: 'Jane Doe',
        PhoneNumberFull: '5552222222',
      }),
    ];
    const repeatCallers = [
      buildRepeatCaller({
        CallerNum: '100',
        Alias: 'Janey1234',
        History: 'First profile',
      }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Janey1234', History: '' }),
    ];

    const candidates = buildCaseCandidates(callReports, repeatCallers);

    expect(candidates).toEqual([
      {
        callerNums: ['100', '200'],
        label: 'Jane Doe',
        linkedProfileName: 'Janey1234',
        summary: 'First profile',
        contactTaskIds: ['TK_legacy_1', 'TK_legacy_2'],
        distinctPhoneNumbers: ['5551111111', '5552222222'],
      },
    ]);
  });

  test('orders joined History deterministically even for a non-numeric CallerNum', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: 'weird-id-b',
        PhoneNumberFull: '5551111111',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: 'weird-id-a',
        PhoneNumberFull: '5552222222',
      }),
    ];
    const repeatCallers = [
      buildRepeatCaller({
        CallerNum: 'weird-id-b',
        Alias: 'Janey1234',
        History: 'B profile',
      }),
      buildRepeatCaller({
        CallerNum: 'weird-id-a',
        Alias: 'Janey1234',
        History: 'A profile',
      }),
    ];

    const [candidate] = buildCaseCandidates(callReports, repeatCallers);

    expect(candidate.summary).toEqual('A profile\n---\nB profile');
  });

  test('joins every distinct History across a merged group, not just the first', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: '100',
        PhoneNumberFull: '5551111111',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: '200',
        PhoneNumberFull: '5552222222',
      }),
    ];
    const repeatCallers = [
      buildRepeatCaller({
        CallerNum: '100',
        Alias: 'Janey1234',
        History: 'First profile',
      }),
      buildRepeatCaller({
        CallerNum: '200',
        Alias: 'Janey1234',
        History: 'Second profile',
      }),
    ];

    const [candidate] = buildCaseCandidates(callReports, repeatCallers);

    expect(candidate.summary).toEqual('First profile\n---\nSecond profile');
  });

  test('does not repeat identical History values shared across a merged group', () => {
    const callReports = [
      buildCallReport({
        CallReportNum: '1',
        CallerNum: '100',
        PhoneNumberFull: '5551111111',
      }),
      buildCallReport({
        CallReportNum: '2',
        CallerNum: '200',
        PhoneNumberFull: '5552222222',
      }),
    ];
    const repeatCallers = [
      buildRepeatCaller({ CallerNum: '100', Alias: 'Janey1234', History: 'Same note' }),
      buildRepeatCaller({ CallerNum: '200', Alias: 'Janey1234', History: 'Same note' }),
    ];

    const [candidate] = buildCaseCandidates(callReports, repeatCallers);

    expect(candidate.summary).toEqual('Same note');
  });
});
