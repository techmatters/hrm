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

require('dotenv').config();

const pgPromise = require('pg-promise');

const resourceUsername = process.env.RESOURCES_USERNAME || 'resources';
const resourcePassword = process.env.RESOURCES_PASSWORD || null;
const config = {
  username: process.env.RDS_USERNAME || 'hrm',
  password: process.env.RDS_PASSWORD || null,
  database: process.env.RDS_DBNAME || 'hrmdb',
  host: process.env.RDS_RESOURCES_HOSTNAME || process.env.RDS_HOSTNAME || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
};

const CONNECT_ATTEMPT_SECONDS = 5;
const pgp = pgPromise({});

async function create() {
  let lastErr;
  const timeoutPoint = Date.now() + CONNECT_ATTEMPT_SECONDS * 1000;

  const createUserConnection = pgp(
    `postgres://${encodeURIComponent(config.username)}${
      config.password ? `:${encodeURIComponent(config.password)}` : ''
    }@${config.host}:${config.port}/${encodeURIComponent(
      config.database,
    )}?&application_name=resources-db-create-script`,
  );

  while (Date.now() < timeoutPoint) {
    try {
      const { userCount } = await createUserConnection.one(
        `SELECT COUNT(*) AS "userCount" FROM pg_user where usename = $<resourceUsername>`,
        { resourceUsername },
      );

      if (Number.parseInt(userCount) === 0) {
        console.log(`Creating user '${resourceUsername}' to manage resources schema`);
        await createUserConnection.none(`
          CREATE ROLE ${resourceUsername} WITH LOGIN PASSWORD '${resourcePassword}' VALID UNTIL 'infinity';
          GRANT CONNECT, CREATE ON DATABASE hrmdb TO ${resourceUsername};
        `);
      } else {
        console.log(`User '${resourceUsername}' already exists`);
      }

      lastErr = undefined;
      break;
    } catch (err) {
      if (err.message?.toLowerCase()?.includes('connect')) {
        console.debug(
          "Creation failed connecting to DB, assuming it's not ready yet & retrying...",
        );
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        await new Promise(resolve => setTimeout(resolve, 250));
        lastErr = err;
      } else {
        throw err;
      }
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  const createSchemaConnection = pgp(
    `postgres://${encodeURIComponent(resourceUsername)}${
      resourcePassword ? `:${encodeURIComponent(resourcePassword)}` : ''
    }@${config.host}:${config.port}/${encodeURIComponent(
      config.database,
    )}?&application_name=resources-db-create-script`,
  );

  console.log(`Creating  resources schema`);
  await createSchemaConnection.none(`
      CREATE SCHEMA IF NOT EXISTS resources AUTHORIZATION resources;
  `);
}

create().catch(err => {
  throw err;
});
