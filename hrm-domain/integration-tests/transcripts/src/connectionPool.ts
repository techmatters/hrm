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

const config = {
  username: 'hrm',
  password: null,
  database: 'hrmdb',
  host: 'localhost',
  port: 5432,
  dialect: 'postgres',
};

export const pgp = pgPromise({});

export const db = pgp(
  `postgres://${encodeURIComponent(config.username)}:${encodeURIComponent(
    config.password,
  )}@${config.host}:${config.port}/${encodeURIComponent(
    config.database,
  )}?&application_name=integration-test`,
);

const { builtins } = pgp.pg.types;

[builtins.DATE, builtins.TIMESTAMP, builtins.TIMESTAMPTZ].forEach(typeId => {
  pgp.pg.types.setTypeParser(typeId, value => {
    return value === null ? null : new Date(value).toISOString();
  });
});
