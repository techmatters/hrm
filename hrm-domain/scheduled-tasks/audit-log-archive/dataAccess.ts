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

import QueryStream from 'pg-query-stream';
import { getDbForAdmin } from '@tech-matters/hrm-core/dbConnection';
import ReadableStream = NodeJS.ReadableStream;

const SELECT_AUDITS_BEFORE_SQL = `
  SELECT *
  FROM public."Audits"
  WHERE timestamp_clock < $1
  ORDER BY id
`;

const DELETE_AUDITS_BEFORE_SQL = `
  DELETE FROM public."Audits"
  WHERE timestamp_clock < $1
`;

export const streamAuditsBefore = async (cutoff: Date): Promise<ReadableStream> => {
  const query = new QueryStream(SELECT_AUDITS_BEFORE_SQL, [cutoff], {
    highWaterMark: 1000,
  });
  const db = getDbForAdmin();

  return new Promise((resolve, reject) => {
    db.stream(query, stream => resolve(stream)).catch(reject);
  });
};

export const deleteAuditsBefore = async (cutoff: Date): Promise<number> =>
  getDbForAdmin().result(DELETE_AUDITS_BEFORE_SQL, [cutoff], result => result.rowCount);
