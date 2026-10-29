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

const FIND_OLDEST_AUDIT_TIMESTAMP_SQL = `
  SELECT MIN(timestamp_clock) AS "timestamp"
  FROM public."Audits"
  WHERE timestamp_clock < $1
`;

const SELECT_AUDIT_BATCH_FOR_DAY_SQL = `
  SELECT *
  FROM public."Audits"
  WHERE timestamp_clock >= $1
    AND timestamp_clock < $2
  ORDER BY timestamp_clock, id
  LIMIT $3
`;

const DELETE_AUDITS_BY_IDS_SQL = `
  DELETE FROM public."Audits"
  WHERE id = ANY($1::integer[])
`;

export const findOldestAuditTimestamp = async (before: Date): Promise<Date | null> => {
  const { timestamp } = await getDbForAdmin().one<{ timestamp: Date | null }>(
    FIND_OLDEST_AUDIT_TIMESTAMP_SQL,
    [before],
  );
  return timestamp;
};

export const streamAuditBatchForDay = async (
  start: Date,
  end: Date,
  batchSize: number,
): Promise<ReadableStream> => {
  const query = new QueryStream(
    SELECT_AUDIT_BATCH_FOR_DAY_SQL,
    [start, end, batchSize + 1],
    { highWaterMark: 1000 },
  );
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
