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

/**
 * The fields this module requires from a single call record.
 */
export type ICarolCallReportRecord = {
  CallReportNum: string;
  CallerNum: string;
  CallerName: string;
  PhoneNumberFull: string;
  CallDateAndTimeStart: string;
};

/**
 * The fields this module needs from a caller's profile record.
 */
export type ICarolRepeatCallerRecord = {
  CallerNum: string;
  Alias: string;
  History: string;
};

/**
 * A record identified as eligible for an Aselo Case, keyed by a shared
 * Alias. `callerNums` holds every CallerNum merged into that identity.
 */
export type CaseCandidate = {
  callerNums: string[];
  label: string;
  linkedProfileName?: string;
  summary?: string;
  contactTaskIds: string[];
  distinctPhoneNumbers: string[];
};

const isBlank = (value: string | undefined): boolean => !value || value.trim() === '';

/**
 * A usable Alias: filters out blank Aliases.
 */
const isRealAlias = (alias: string | undefined): boolean => !isBlank(alias);

/**
 * Groups call records by CallerNum, the join key between the two source
 * records. Order within each group is preserved.
 */
export const groupCallReportsByCallerNum = (
  records: ICarolCallReportRecord[],
): Map<string, ICarolCallReportRecord[]> => {
  const groups = new Map<string, ICarolCallReportRecord[]>();
  for (const record of records) {
    const existing = groups.get(record.CallerNum);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(record.CallerNum, [record]);
    }
  }
  return groups;
};

/**
 * Digits-only form of a phone number, with a leading NANP "1" country code
 * stripped so formatting/country-code variants of one number match.
 */
const normalizePhoneNumber = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 11 && digitsOnly.startsWith('1')
    ? digitsOnly.slice(1)
    : digitsOnly;
};

/**
 * Every distinct phone number used across a set of calls, normalized to
 * digits only. Blanks and no-digit values are excluded.
 */
export const distinctPhoneNumbers = (records: ICarolCallReportRecord[]): string[] => {
  const seen = new Set<string>();
  for (const record of records) {
    if (!isBlank(record.PhoneNumberFull)) {
      const normalized = normalizePhoneNumber(record.PhoneNumberFull);
      if (normalized) {
        seen.add(normalized);
      }
    }
  }
  return [...seen];
};

/**
 * Groups CallerNums sharing the same Alias (see `isRealAlias`) into one
 * identity; everything else stays its own group.
 */
export const resolveIdentityGroups = (
  distinctCallerNums: string[],
  repeatCallers: ICarolRepeatCallerRecord[],
): string[][] => {
  const aliasByCallerNum = new Map(repeatCallers.map(r => [r.CallerNum, r.Alias]));
  const groupsByAlias = new Map<string, string[]>();
  const soloGroups: string[][] = [];

  for (const callerNum of distinctCallerNums) {
    const alias = aliasByCallerNum.get(callerNum);
    if (isRealAlias(alias)) {
      const normalizedAlias = alias!.trim().toLowerCase();
      const existing = groupsByAlias.get(normalizedAlias);
      if (existing) {
        existing.push(callerNum);
      } else {
        groupsByAlias.set(normalizedAlias, [callerNum]);
      }
    } else {
      soloGroups.push([callerNum]);
    }
  }

  return [...groupsByAlias.values(), ...soloGroups];
};

type QualifyingGroup = { callerNums: string[]; phones: string[] };

/**
 * Shared by `qualifyingIdentityGroups` and `buildCaseCandidates` so grouping
 * and phone-counting only happen once.
 */
const computeQualifyingGroups = (
  callReportsByCallerNum: Map<string, ICarolCallReportRecord[]>,
  repeatCallers: ICarolRepeatCallerRecord[],
): QualifyingGroup[] => {
  const distinctCallerNums = [...callReportsByCallerNum.keys()].filter(
    callerNum => !isBlank(callerNum),
  );
  const identityGroups = resolveIdentityGroups(distinctCallerNums, repeatCallers);

  return identityGroups
    .map(callerNums => {
      const combinedRecords = callerNums.flatMap(
        callerNum => callReportsByCallerNum.get(callerNum) ?? [],
      );
      return { callerNums, phones: distinctPhoneNumbers(combinedRecords) };
    })
    .filter(group => group.phones.length >= 2);
};

/**
 * Which identity groups qualify for a Case: 2+ distinct phone numbers after
 * the Alias-based merge. Excludes a blank CallerNum; negative/zero values
 * are not excluded.
 */
export const qualifyingIdentityGroups = (
  callReports: ICarolCallReportRecord[],
  repeatCallers: ICarolRepeatCallerRecord[],
): string[][] => {
  const callReportsByCallerNum = groupCallReportsByCallerNum(callReports);
  return computeQualifyingGroups(callReportsByCallerNum, repeatCallers).map(
    group => group.callerNums,
  );
};

const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * The value of `keyOf` that appears most often; ties broken by most recent
 * call, then alphabetically.
 */
const pickMostRepresentative = (
  records: ICarolCallReportRecord[],
  keyOf: (record: ICarolCallReportRecord) => string,
): string => {
  const countByKey = new Map<string, number>();
  const latestMsByKey = new Map<string, number>();

  for (const record of records) {
    const key = keyOf(record);
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);

    const callMs = new Date(record.CallDateAndTimeStart).getTime();
    const currentLatestMs = latestMsByKey.get(key) ?? -Infinity;
    if (!Number.isNaN(callMs) && callMs > currentLatestMs) {
      latestMsByKey.set(key, callMs);
    }
  }

  const keys = [...countByKey.keys()];
  keys.sort((a, b) => {
    const countDiff = (countByKey.get(b) ?? 0) - (countByKey.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;

    const latestDiff =
      (latestMsByKey.get(b) ?? -Infinity) - (latestMsByKey.get(a) ?? -Infinity);
    if (latestDiff !== 0) return latestDiff;

    return a.localeCompare(b);
  });

  return keys[0];
};

/**
 * Picks one CallerName for a Case's label, tallied on a trimmed/case-folded
 * key so spelling variants don't split the vote.
 */
export const resolveCaseLabel = (records: ICarolCallReportRecord[]): string => {
  if (records.length === 0) {
    throw new Error('resolveCaseLabel requires at least one record');
  }

  const winningNormalizedName = pickMostRepresentative(records, r =>
    normalizeName(r.CallerName),
  );
  const recordsWithWinningName = records.filter(
    r => normalizeName(r.CallerName) === winningNormalizedName,
  );
  return pickMostRepresentative(recordsWithWinningName, r => r.CallerName).trim();
};

/**
 * Builds one CaseCandidate per qualifying identity group. `linkedProfileName`
 * / `summary` come from member profile records if any exist; a group can
 * still qualify and create a Case with neither set.
 */
export const buildCaseCandidates = (
  callReports: ICarolCallReportRecord[],
  repeatCallers: ICarolRepeatCallerRecord[],
): CaseCandidate[] => {
  const callReportsByCallerNum = groupCallReportsByCallerNum(callReports);
  const repeatCallerByCallerNum = new Map(repeatCallers.map(r => [r.CallerNum, r]));
  const qualifyingGroups = computeQualifyingGroups(callReportsByCallerNum, repeatCallers);

  return qualifyingGroups.map(({ callerNums, phones }) => {
    const combinedRecords = callerNums.flatMap(
      callerNum => callReportsByCallerNum.get(callerNum) ?? [],
    );

    const candidate: CaseCandidate = {
      callerNums,
      label: resolveCaseLabel(combinedRecords),
      contactTaskIds: combinedRecords.map(record => `TK_legacy_${record.CallReportNum}`),
      distinctPhoneNumbers: phones,
    };

    // Members share the same normalized Alias; displays whichever member's
    // most recent call is latest.
    const membersWithAlias = callerNums.filter(callerNum =>
      isRealAlias(repeatCallerByCallerNum.get(callerNum)?.Alias),
    );
    if (membersWithAlias.length > 0) {
      const latestCallMsByCallerNum = new Map<string, number>();
      for (const record of combinedRecords) {
        const callMs = new Date(record.CallDateAndTimeStart).getTime();
        const currentLatestMs =
          latestCallMsByCallerNum.get(record.CallerNum) ?? -Infinity;
        if (!Number.isNaN(callMs) && callMs > currentLatestMs) {
          latestCallMsByCallerNum.set(record.CallerNum, callMs);
        }
      }
      const [winningCallerNum] = [...membersWithAlias].sort((a, b) => {
        const latestDiff =
          (latestCallMsByCallerNum.get(b) ?? -Infinity) -
          (latestCallMsByCallerNum.get(a) ?? -Infinity);
        if (latestDiff !== 0) return latestDiff;
        return a.localeCompare(b);
      });
      candidate.linkedProfileName = repeatCallerByCallerNum
        .get(winningCallerNum)!
        .Alias.trim();
    }

    const sortedMembers = [...callerNums].sort((a, b) => {
      const diff = Number(a) - Number(b);
      return Number.isNaN(diff) ? a.localeCompare(b) : diff;
    });
    const histories = sortedMembers
      .map(callerNum => repeatCallerByCallerNum.get(callerNum)?.History)
      .filter((history): history is string => !isBlank(history));
    const distinctHistories = [...new Set(histories)];
    if (distinctHistories.length > 0) {
      candidate.summary = distinctHistories.join('\n---\n');
    }

    return candidate;
  });
};
