// eslint-disable-next-line global-require,import/no-extraneous-dependencies
const { Umzug, SequelizeStorage } = require('umzug');
const pathLib = require('path');
const { sequelize, Sequelize } = require('../../src/models/index');

const CONNECT_ATTEMPT_SECONDS = 20;

const parent = new Umzug({
  migrations: {
    glob: pathLib.join(process.cwd(), './migrations/*.js'),
    resolve: ({ name, path, context }) => {
      // eslint-disable-next-line global-require,import/no-dynamic-require
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context, Sequelize),
        down: async () => migration.down(context, Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
});

const umzug = new Umzug({
  ...parent.options,
  migrations: async ctx => {
    const migrations = await parent.migrations(ctx);
    console.log(migrations.map(m => m.path));
    return migrations;
  },
});

async function migrate() {
  const timeoutPoint = Date.now() + CONNECT_ATTEMPT_SECONDS * 1000;
  let ret;
  let lastErr;
  console.log(timeoutPoint);
  while (Date.now() < timeoutPoint) {
    try {
      // eslint-disable-next-line no-await-in-loop
      console.log('Umzug migration starting.');
      ret = await umzug.up();
      console.log('Migration complete.');
      break;
    } catch (err) {
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
