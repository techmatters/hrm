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

const SELECT_AUDITS_TO_ARCHIVE_SQL = `
  SELECT
    public."Audits".*,
    to_char(timestamp_clock AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "_utcDay"
  FROM public."Audits"
  WHERE timestamp_clock < $1
  ORDER BY timestamp_clock, id
`;

const DELETE_AUDITS_BY_IDS_SQL = `
  DELETE FROM public."Audits"
  WHERE id = ANY($1::integer[])
`;

export const streamAuditsToArchive = async (before: Date): Promise<ReadableStream> => {
  const query = new QueryStream(SELECT_AUDITS_TO_ARCHIVE_SQL, [before], {
    highWaterMark: 1000,
  });
  const db = getDbForAdmin();

  return new Promise((resolve, reject) => {
    db.stream(query, stream => resolve(stream)).catch(reject);
  });
};

export const deleteAuditsByIds = async (ids: number[]): Promise<number> => {
  if (!ids.length) return 0;
  return getDbForAdmin().result(
    DELETE_AUDITS_BY_IDS_SQL,
    [ids],
    result => result.rowCount,
  );
};
