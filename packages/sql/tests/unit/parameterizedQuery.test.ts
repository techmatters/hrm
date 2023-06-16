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

import { parameterizedQuery } from '../../src';

describe('parameterizedQuery', () => {
  const testCases = [
    {
      description:
        'should convert SQL statement and named parameters to PostgreSQL query with positional parameters',
      sql: 'SELECT * FROM users WHERE age >= $<minAge> AND country IN ($<countries>)',
      params: {
        minAge: 18,
        countries: ['USA', 'Canada', 'UK'],
      },
      expectedQuery: 'SELECT * FROM users WHERE age >= $1 AND country IN ($2)',
      expectedValues: [18, ['USA', 'Canada', 'UK']],
    },
    {
      description: 'should flatten nested maps of values',
      sql:
        'INSERT INTO users (name, address.line1, address.city, settings) VALUES ($<name>, $<address.line1>, $<address.city>, $<settings:json>)',
      params: {
        name: 'John Doe',
        address: {
          line1: '123 Main St',
          city: 'New York',
        },
        settings: {
          darkMode: true,
          theme: 'light',
        },
      },
      expectedQuery:
        'INSERT INTO users (name, address.line1, address.city, settings) VALUES ($1, $2, $3, $4)',
      expectedValues: ['John Doe', '123 Main St', 'New York', { darkMode: true, theme: 'light' }],
    },
    {
      description: 'should handle array values as single positional parameters',
      sql: 'SELECT * FROM users WHERE id IN ($<ids>) AND role = $<role>',
      params: {
        ids: [1, 2, 3],
        role: 'admin',
      },
      expectedQuery: 'SELECT * FROM users WHERE id IN ($1) AND role = $2',
      expectedValues: [[1, 2, 3], 'admin'],
    },
    {
      description:
        'should handle array values as comma-separated positional parameters when using :csv suffix',
      sql: 'SELECT * FROM users WHERE id IN ($<ids:csv>) AND role = $<role>',
      params: {
        ids: [1, 2, 3],
        role: 'admin',
      },
      expectedQuery: 'SELECT * FROM users WHERE id IN ($1, $2, $3) AND role = $4',
      expectedValues: [1, 2, 3, 'admin'],
    },
    {
      description: 'should handle nested arrays as single positional parameters',
      sql: 'INSERT INTO users (name, hobbies) VALUES ($<name>, $<hobbies>)',
      params: {
        name: 'John Doe',
        hobbies: [['reading', 'coding'], ['gaming']],
      },
      expectedQuery: 'INSERT INTO users (name, hobbies) VALUES ($1, $2)',
      expectedValues: ['John Doe', [['reading', 'coding'], ['gaming']]],
    },
    {
      description:
        'nested arrays should not be flattened, but be a comma-separated positional set of array parameters when using :csv suffix',
      sql: 'INSERT INTO users (name, hobbies_1, hobbies_2) VALUES ($<name>, $<hobbies:csv>)',
      params: {
        name: 'John Doe',
        hobbies: [['reading', 'coding'], ['gaming']],
      },
      expectedQuery: 'INSERT INTO users (name, hobbies_1, hobbies_2) VALUES ($1, $2, $3)',
      expectedValues: ['John Doe', ['reading', 'coding'], ['gaming']],
    },
    {
      description: 'should handle JSONB values specified using :json suffix',
      sql: 'INSERT INTO users (name, settings) VALUES ($<name>, $<settings:json>)',
      params: {
        name: 'John Doe',
        settings: {
          darkMode: true,
          theme: 'light',
        },
      },
      expectedQuery: 'INSERT INTO users (name, settings) VALUES ($1, $2)',
      expectedValues: ['John Doe', { darkMode: true, theme: 'light' }],
    },
  ];

  test.each(testCases)('$description', ({ sql, params, expectedQuery, expectedValues }) => {
    const { text, values } = parameterizedQuery(sql, params);
    expect(text).toBe(expectedQuery);
    expect(values).toEqual(expectedValues);
  });
});
