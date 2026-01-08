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

// eslint-disable-next-line global-require,import/no-extraneous-dependencies
const { Umzug, SequelizeStorage } = require('umzug');
const pathLib = require('path');
const fs = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const Sequelize = require('sequelize');

require('dotenv').config();

const config = {
  username: process.env.RDS_USERNAME || 'hrm',
  password: process.env.RDS_PASSWORD || null,
  database: process.env.RDS_DBNAME || 'hrmdb',
  host: process.env.RDS_HOSTNAME || '127.0.0.1',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
};

config.logging = process.env.SEQUELIZE_STATEMENT_LOGGING;

let sequelize;

console.log(`Trying with: ${[config.host, config.username].join(', ')}`);

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const CONNECT_ATTEMPT_SECONDS = 20;
const migrationDirectory = pathLib.join(process.cwd(), './migrations/');
const context = sequelize.getQueryInterface();

// Glob based migrations stopped working locally for SJH, manually locate files instead
const umzug = new Umzug({
  migrations: fs
    .readdirSync(pathLib.join(process.cwd(), './migrations/'))
    .filter(file => file.endsWith('.js'))
    .map(filename => {
      // eslint-disable-next-line global-require,import/no-dynamic-require
      const migration = require(pathLib.join(migrationDirectory, filename));
      return {
        name: filename,
        up: async () => migration.up(context, Sequelize),
        down: async () => migration.down(context, Sequelize),
      };
    }),
  context,
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

async function migrate() {
  const timeoutPoint = Date.now() + CONNECT_ATTEMPT_SECONDS * 1000;
  let ret;
  let lastErr;
  console.log(
    'Umzug migration starting.',
    pathLib.join(process.cwd(), './migrations/*.js'),
  );
  while (Date.now() < timeoutPoint) {
    try {
      // eslint-disable-next-line no-await-in-loop
      ret = await umzug.up();
      console.log('Migration complete.', JSON.stringify(ret));
      break;
    } catch (err) {
      if (
        ['SequelizeConnectionRefusedError', 'SequelizeConnectionError'].includes(err.name)
      ) {
        console.debug(
          "Migration failed to connect to DB, assuming it's not ready yet & retrying...",
        );
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        await new Promise(resolve => setTimeout(resolve, 250));
        lastErr = err;
      } else {
        throw err;
      }
    }
  }
  if (ret) {
    return ret;
  }
  throw lastErr;
}

migrate().catch(err => {
  throw err;
});
