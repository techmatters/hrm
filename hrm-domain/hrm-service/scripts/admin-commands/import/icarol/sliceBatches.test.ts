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
import { compareCallReportRows } from './sliceBatches';

const row = (CallDateAndTimeStart: string, CallReportNum: string) => ({
  CallDateAndTimeStart,
  CallReportNum,
});

describe('compareCallReportRows', () => {
  test('orders by date first', () => {
    const earlier = row('2026-01-01 09:00:00', '5');
    const later = row('2026-01-02 09:00:00', '1');
    expect(compareCallReportRows(earlier, later)).toBeLessThan(0);
    expect(compareCallReportRows(later, earlier)).toBeGreaterThan(0);
  });

  test('falls back to CallReportNum as a number on a date tie', () => {
    const a = row('2026-01-01 09:00:00', '2');
    const b = row('2026-01-01 09:00:00', '10');
    expect(compareCallReportRows(a, b)).toBeLessThan(0);
  });

  test('stays deterministic when the date is malformed', () => {
    const a = row('not-a-date', '2');
    const b = row('not-a-date', '10');
    expect(compareCallReportRows(a, b)).toBeLessThan(0);
    expect(compareCallReportRows(b, a)).toBeGreaterThan(0);
  });

  test('stays deterministic when CallReportNum is non-numeric, via the string fallback', () => {
    const a = row('2026-01-01 09:00:00', 'abc');
    const b = row('2026-01-01 09:00:00', 'abd');
    expect(compareCallReportRows(a, b)).toBeLessThan(0);
    expect(compareCallReportRows(b, a)).toBeGreaterThan(0);
    // Total order: never zero for two distinct rows, so sort is stable and repeatable.
    expect(compareCallReportRows(a, b)).not.toBe(0);
  });

  test('is 0 only for genuinely identical rows', () => {
    const a = row('2026-01-01 09:00:00', '2');
    const b = row('2026-01-01 09:00:00', '2');
    expect(compareCallReportRows(a, b)).toBe(0);
  });
});
