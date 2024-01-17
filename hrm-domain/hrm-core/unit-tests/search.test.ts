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

import { getPaginationElements } from '../search';

describe('getPaginationElements()', () => {
  test('limit and offset', () => {
    const query = { limit: '10', offset: '20' };

    const { limit, offset } = getPaginationElements(query);

    expect(limit).toBe(10);
    expect(offset).toBe(20);
  });

  test('invalid limit', () => {
    const { limit: nonNumberLimit } = getPaginationElements({ limit: 'invalid' });
    const { limit: tooBigLimit } = getPaginationElements({ limit: '2000' });
    expect(nonNumberLimit).toBe(1000);
    expect(tooBigLimit).toBe(1000);
  });

  test('invalid offset', () => {
    const { offset: nonNumberOffset } = getPaginationElements({ offset: 'invalid' });
    expect(nonNumberOffset).toBe(0);
  });
});
