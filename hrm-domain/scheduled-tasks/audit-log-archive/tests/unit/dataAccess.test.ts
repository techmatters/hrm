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

const mockDb = {
  stream: jest.fn(),
};

jest.mock('pg-query-stream', () => jest.fn());
jest.mock('@tech-matters/hrm-core/dbConnection', () => ({
  getDbForAdmin: () => mockDb,
}));

import QueryStream from 'pg-query-stream';
import { Readable } from 'stream';
import { streamAuditBatchForDay } from '../../dataAccess';

describe('streamAuditBatchForDay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.stream.mockImplementation((_query, callback) => {
      callback(Readable.from([]));
      return Promise.resolve();
    });
  });

  test('queries a day window with one extra row beyond the configured batch size', async () => {
    const start = new Date('2024-10-26T00:00:00.000Z');
    const end = new Date('2024-10-27T00:00:00.000Z');

    await streamAuditBatchForDay(start, end, 2500);

    expect(QueryStream).toHaveBeenCalledWith(
      expect.stringMatching(/LIMIT \$3/),
      [start, end, 2501],
      { highWaterMark: 1000 },
    );
  });
});
