const { Umzug, SequelizeStorage } = require('umzug');
const pathLib = require('path');
const { sequelize } = require('../../src/models/index.js');

const CONNECT_ATTEMPT_SECONDS = 2;

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
  const timeoutPoint = Date.now() + CONNECT_ATTEMPT_SECONDS;
  let ret;
  let lastErr;
  console.log(timeoutPoint);
  while (Date.now() < timeoutPoint) {
    try {
      // eslint-disable-next-line no-await-in-loop
      ret = await umzug.up();
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
