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

import * as pgPromise from 'pg-promise';
import { mockConnection, mockTask } from '../mock-db';
import * as resourceDb from '../../../src/resource/resource-data-access';

let conn: pgPromise.ITask<unknown>;

beforeEach(() => {
  conn = mockConnection();
});

describe('getById', () => {
  test('Runs a SELECT against the Resources table on the DB', async () => {
    mockTask(conn);
    const oneOrNoneSpy = jest
      .spyOn(conn, 'oneOrNone')
      .mockResolvedValue({ name: 'Fake Resource', id: 'FAKE_RESOURCE' });

    const result = await resourceDb.getById('AC_FAKE', 'FAKE_RESOURCE');

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Resources'), {
      accountSid: 'AC_FAKE',
      resourceIds: ['FAKE_RESOURCE'],
    });
    expect(result).toStrictEqual({ name: 'Fake Resource', id: 'FAKE_RESOURCE' });
  });
});

describe('getByIdList', () => {
  test('Runs a SELECT against the Resources table on the DB, takes the results from the first DB result set and the count from the second', async () => {
    const results = [
      { name: 'Fake Resource', id: 'FAKE_RESOURCE' },
      { name: 'Other Fake Resource', id: 'OTHER_FAKE_RESOURCE' },
    ];
    mockTask(conn);
    const manyOrNoneSpy = jest.spyOn(conn, 'manyOrNone').mockResolvedValue([
      { name: 'Fake Resource', id: 'FAKE_RESOURCE' },
      { name: 'Other Fake Resource', id: 'OTHER_FAKE_RESOURCE' },
    ]);

    const result = await resourceDb.getByIdList('AC_FAKE', [
      'FAKE_RESOURCE',
      'OTHER_FAKE_RESOURCE',
    ]);

    expect(manyOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Resources'), {
      accountSid: 'AC_FAKE',
      resourceIds: ['FAKE_RESOURCE', 'OTHER_FAKE_RESOURCE'],
    });
    expect(result).toStrictEqual(results);
  });
});

describe('getWhereNameContains', () => {
  test('Runs a SELECT ILIKE against the Resources table on the DB, takes the results from the first DB result set and the count from the second', async () => {
    const results = ['FAKE_RESOURCE', 'OTHER_FAKE_RESOURCE'];
    mockTask(conn);
    const multiSpy = jest
      .spyOn(conn, 'multi')
      .mockResolvedValue([
        [{ id: 'FAKE_RESOURCE' }, { id: 'OTHER_FAKE_RESOURCE' }],
        [{ totalCount: 100 }],
      ]);

    const result = await resourceDb.getWhereNameContains('AC_FAKE', 'Fake', 1337, 42);

    expect(multiSpy).toHaveBeenCalledWith(expect.stringContaining('Resources'), {
      accountSid: 'AC_FAKE',
      namePattern: '%Fake%',
      start: 1337,
      limit: 42,
    });
    expect(result).toStrictEqual({ results, totalCount: 100 });
  });
  test('No results at all - returns empty result set and zero totalCount', async () => {
    mockTask(conn);
    jest.spyOn(conn, 'multi').mockResolvedValue([[], [{ totalCount: 0 }]]);

    const result = await resourceDb.getWhereNameContains('AC_FAKE', 'Fake', 1337, 42);
    expect(result).toStrictEqual({ results: [], totalCount: 0 });
  });
  test('No results in specified pagination window but some in total set - returns empty result set and correct totalCount', async () => {
    mockTask(conn);
    jest.spyOn(conn, 'multi').mockResolvedValue([[], [{ totalCount: 100 }]]);

    const result = await resourceDb.getWhereNameContains('AC_FAKE', 'Fake', 1337, 42);

    expect(result).toStrictEqual({ results: [], totalCount: 100 });
  });
});
