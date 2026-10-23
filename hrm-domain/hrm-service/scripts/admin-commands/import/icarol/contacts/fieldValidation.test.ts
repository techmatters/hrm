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
  findUnknownColumns,
  findUnknownValueTokens,
  formatValueWarnings,
  recordUnknownValue,
  ValueWarningRegistry,
} from './fieldValidation';

describe('findUnknownColumns', () => {
  const knownColumns = { ColumnA: 'import', ColumnB: 'ignore' };

  test('returns an empty array when every header is known', () => {
    expect(findUnknownColumns(['ColumnA', 'ColumnB'], knownColumns)).toEqual([]);
  });

  test('returns headers not present in the known-columns registry', () => {
    expect(findUnknownColumns(['ColumnA', 'NewColumn'], knownColumns)).toEqual([
      'NewColumn',
    ]);
  });

  test('returns an empty array for an empty header list', () => {
    expect(findUnknownColumns([], knownColumns)).toEqual([]);
  });
});

describe('findUnknownValueTokens', () => {
  const knownFieldValues = { FieldA: new Set(['Known1', 'Known2']) };
  const multiselectFields = new Set(['FieldA']);

  test('returns an empty array for a field with no registered value set', () => {
    expect(
      findUnknownValueTokens('FieldB', 'anything', knownFieldValues, multiselectFields),
    ).toEqual([]);
  });

  test('returns an empty array when the value matches, case-insensitively', () => {
    expect(
      findUnknownValueTokens('FieldA', 'known1', knownFieldValues, multiselectFields),
    ).toEqual([]);
  });

  test('returns the value when it matches nothing known', () => {
    expect(
      findUnknownValueTokens('FieldA', 'Surprise', knownFieldValues, multiselectFields),
    ).toEqual(['Surprise']);
  });

  test('checks each token of a multiselect value independently', () => {
    expect(
      findUnknownValueTokens(
        'FieldA',
        'Known1; Surprise; Known2',
        knownFieldValues,
        multiselectFields,
      ),
    ).toEqual(['Surprise']);
  });

  test('does not split a non-multiselect field on semicolons', () => {
    const singleValueFields = new Set<string>();
    expect(
      findUnknownValueTokens(
        'FieldA',
        'Known1; Surprise',
        knownFieldValues,
        singleValueFields,
      ),
    ).toEqual(['Known1; Surprise']);
  });
});

describe('recordUnknownValue and formatValueWarnings', () => {
  test('records a new (field, value) pair with a count of one', () => {
    const registry: ValueWarningRegistry = new Map();
    recordUnknownValue(registry, 'FieldA', 'Surprise', '111');
    expect(formatValueWarnings(registry)).toEqual([
      'Field "FieldA": unexpected value "Surprise" seen 1 time(s) (e.g. call report(s) 111)',
    ]);
  });

  test('aggregates repeat occurrences of the same (field, value) pair', () => {
    const registry: ValueWarningRegistry = new Map();
    recordUnknownValue(registry, 'FieldA', 'Surprise', '111');
    recordUnknownValue(registry, 'FieldA', 'Surprise', '222');
    expect(formatValueWarnings(registry)).toEqual([
      'Field "FieldA": unexpected value "Surprise" seen 2 time(s) (e.g. call report(s) 111, 222)',
    ]);
  });

  test('caps the number of sample call report numbers', () => {
    const registry: ValueWarningRegistry = new Map();
    for (let i = 0; i < 10; i++) {
      recordUnknownValue(registry, 'FieldA', 'Surprise', String(i));
    }
    const [warning] = formatValueWarnings(registry);
    expect(warning).toBe(
      'Field "FieldA": unexpected value "Surprise" seen 10 time(s) (e.g. call report(s) 0, 1, 2, 3, 4)',
    );
  });

  test('tracks different (field, value) pairs separately', () => {
    const registry: ValueWarningRegistry = new Map();
    recordUnknownValue(registry, 'FieldA', 'Surprise', '111');
    recordUnknownValue(registry, 'FieldB', 'Surprise', '111');
    expect(formatValueWarnings(registry)).toHaveLength(2);
  });
});
