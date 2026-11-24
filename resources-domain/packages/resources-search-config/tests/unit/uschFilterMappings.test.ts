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

import { getSearchConfiguration } from '../../src';

describe('USCH search configuration', () => {
  test('categories filter generates a terms filter on categoriesName', () => {
    const { generateElasticsearchQuery } = getSearchConfiguration('USCH');

    const query = generateElasticsearchQuery({
      index: 'resources',
      searchParameters: {
        q: '',
        filters: { categories: ['Housing', 'Food'] },
      },
    });

    expect(query.query).toEqual({
      bool: {
        must: [{ match_all: {} }],
        filter: [{ terms: { categoriesName: ['Housing', 'Food'] } }],
      },
    });
  });
});
