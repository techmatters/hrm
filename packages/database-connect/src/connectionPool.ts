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

import pgPromise from 'pg-promise';

export type ConnectionConfig = {
  host: string;
  port: number | string;
  user: string;
  password: string;
  applicationName: string;
  database: string;
  poolSize?: number;
  connectionTimeoutMillis?: number;
  statement_timeout?: number;
  query_timeout?: number;
};

export const pgp = pgPromise({});

export const connectToPostgres = ({
  user,
  port,
  host,
  password,
  applicationName,
  database,
  poolSize = 10,
  connectionTimeoutMillis,
  query_timeout,
  statement_timeout,
}: ConnectionConfig) =>
  pgp({
    host,
    user,
    password,
    database,
    application_name: applicationName,
    port: typeof port === 'string' ? parseInt(port) : port,
    max: poolSize,
    ...(connectionTimeoutMillis && { connectionTimeoutMillis }),
    ...(query_timeout && { query_timeout }),
    ...(statement_timeout && { connectionTimeoutMillis }),
  });

const { builtins } = pgp.pg.types;

[builtins.DATE, builtins.TIMESTAMP, builtins.TIMESTAMPTZ].forEach(typeId => {
  pgp.pg.types.setTypeParser(typeId, value => {
    return value === null ? null : new Date(value).toISOString();
  });
});
