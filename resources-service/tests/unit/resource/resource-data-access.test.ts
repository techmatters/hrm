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
      resourceId: 'FAKE_RESOURCE',
    });
    expect(result).toStrictEqual({ name: 'Fake Resource', id: 'FAKE_RESOURCE' });
  });
});
