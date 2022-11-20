// eslint-disable-next-line global-require,import/no-extraneous-dependencies
const { Umzug, SequelizeStorage } = require('umzug');
const pathLib = require('path');
const { sequelize, Sequelize } = require('../../src/models/index');
const fs = require('fs');

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
  console.log('Umzug migration starting.', pathLib.join(process.cwd(), './migrations/*.js'));
  while (Date.now() < timeoutPoint) {
    try {
      // eslint-disable-next-line no-await-in-loop
      ret = await umzug.up();
      console.log('Migration complete.', JSON.stringify(ret));
      break;
    } catch (err) {
      console.log('Migration failed. Retrying...');
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      await new Promise(resolve => setTimeout(resolve, 250));
      lastErr = err;
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
