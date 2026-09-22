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
import { splitMultiselectValue } from './contactMapper';

// Returns any header not present in the known-columns registry, taken as a parameter.
export const findUnknownColumns = (
  headers: string[],
  knownColumns: Readonly<Record<string, string>>,
): string[] => headers.filter(header => !(header in knownColumns));

// Trims, lowercases, and collapses whitespace around a slash for comparison.
const normalizeForComparison = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/');

// Returns individual tokens that match nothing known; splits multiselect fields first.
export const findUnknownValueTokens = (
  field: string,
  rawValue: string,
  knownFieldValues: Readonly<Record<string, ReadonlySet<string>>>,
  multiselectFields: ReadonlySet<string>,
): string[] => {
  const knownValues = knownFieldValues[field];
  if (!knownValues) return [];

  const normalizedKnown = new Set([...knownValues].map(normalizeForComparison));
  const tokens = multiselectFields.has(field)
    ? splitMultiselectValue(rawValue)
    : [rawValue.trim()].filter(Boolean);

  return tokens.filter(token => !normalizedKnown.has(normalizeForComparison(token)));
};

export type ValueWarning = {
  field: string;
  value: string;
  count: number;
  sampleCallReportNums: string[];
};

// Aggregates value-level warnings by (field, value) instead of one line per record.
export type ValueWarningRegistry = Map<string, ValueWarning>;

const MAX_SAMPLE_CALL_REPORT_NUMS = 5;

// Records one occurrence, aggregating into an existing (field, value) entry if one exists.
export const recordUnknownValue = (
  registry: ValueWarningRegistry,
  field: string,
  value: string,
  callReportNum: string,
): void => {
  const key = JSON.stringify([field, value]);
  const existing = registry.get(key);
  if (!existing) {
    registry.set(key, { field, value, count: 1, sampleCallReportNums: [callReportNum] });
    return;
  }
  existing.count += 1;
  if (existing.sampleCallReportNums.length < MAX_SAMPLE_CALL_REPORT_NUMS) {
    existing.sampleCallReportNums.push(callReportNum);
  }
};

// Formats accumulated warnings into one summary line per distinct (field, value) pair.
export const formatValueWarnings = (registry: ValueWarningRegistry): string[] =>
  [...registry.values()].map(
    ({ field, value, count, sampleCallReportNums }) =>
      `Field "${field}": unexpected value "${value}" seen ${count} time(s) (e.g. call report(s) ${sampleCallReportNums.join(
        ', ',
      )})`,
  );
