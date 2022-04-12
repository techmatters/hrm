// eslint-disable-next-line global-require,import/no-extraneous-dependencies
const { Umzug, SequelizeStorage } = require('umzug');
const pathLib = require('path');
const { sequelize } = require('../../src/models/index');

const CONNECT_ATTEMPT_SECONDS = 20;

const umzug = new Umzug({
  migrations: {
    glob: pathLib.join(process.cwd(), './migrations/*.js'),
    resolve: ({ name, path, context }) => {
      // eslint-disable-next-line global-require,import/no-dynamic-require
      const migration = require(path);
      return {
        name,
        up: async () => migration.up(context),
        down: async () => migration.down(context),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
});

async function migrate() {
  const timeoutPoint = Date.now() + CONNECT_ATTEMPT_SECONDS * 1000;
  let ret;
  let lastErr;
  console.log(timeoutPoint);
  while (Date.now() < timeoutPoint) {
    try {
      console.log('Attempting migration...');
      // eslint-disable-next-line no-await-in-loop
      ret = await umzug.up();
      console.log('Migration complete.');
      break;
    } catch (err) {
      console.log('Retrying connection...');
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
