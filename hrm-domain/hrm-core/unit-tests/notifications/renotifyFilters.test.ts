/**
 * Copyright (C) 2021-2023 Technology Matters
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

import { parseRenotifyFilters } from '../../notifications/renotifyFilters';

describe('parseRenotifyFilters', () => {
  test('No ids - returns the date range only', () => {
    expect(
      parseRenotifyFilters({ dateFrom: '2024-01-01', dateTo: '2024-12-31' }),
    ).toEqual({ dateFrom: '2024-01-01', dateTo: '2024-12-31', ids: undefined });
  });

  test('Numeric and numeric string ids - returns them as strings', () => {
    expect(parseRenotifyFilters({ ids: [1, '2'] })).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      ids: ['1', '2'],
    });
  });

  test.each([
    ['not a list', '1'],
    ['non numeric id', ['1', 'abc']],
    ['negative id', [-1]],
    ['decimal id', [1.5]],
    ['null id', [null]],
  ])('ids is %s - throws a 400 error', (_, ids) => {
    expect(() => parseRenotifyFilters({ ids })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
