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

import '../mockDb';
import QueryStream from 'pg-query-stream';
import { streamProfileForRenotifying } from '../../profile/profileDataAccess';

jest.mock('pg-query-stream', () => {
  return jest.fn().mockReturnValue({});
});

const MockQueryStream = QueryStream as any as jest.MockedFunction<any>;

describe('streamProfilesForRenotifying', () => {
  let lastQuerySql: string = '';
  beforeEach(() => {
    MockQueryStream.mockImplementation(sql => {
      lastQuerySql = sql;
      return {};
    });
  });

  test('No dates set - uses account, and min / max date placeholders in sql to create query stream', async () => {
    const promise = streamProfileForRenotifying({
      accountSid: 'AC4321',
      filters: { dateFrom: undefined, dateTo: undefined },
      batchSize: 1234,
    });
    console.debug('SQL Query:', lastQuerySql);
    expect(QueryStream).toHaveBeenCalledWith(expect.any(String), [], { batchSize: 1234 });
    expect(lastQuerySql).toContain('AC4321');
    expect(lastQuerySql).toContain("'-infinity'");
    expect(lastQuerySql).toContain("'infinity'");
    expect(promise).toBeTruthy();
  });
});
