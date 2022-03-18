/**
 * Reference: https://github.com/sequelize/express-example/blob/master/models/index.js
 * All the code here was copied from this example provided by sequelize, with some linting
 * fixes applied to it.
 *
 * Context:
 * Our models have the following circular depency:
 * - Contact belongsTo Case (creates FK on Contact, and provides Contact.getCase() method)
 * - Case hasMany Contact (provides Case.getContacts() method)
 *
 * The problem is that sequelize (out-of-the-box) is not prepared for this, so it ends up
 * with circular dependecy issues: https://github.com/sequelize/sequelize/issues/5792
 *
 * How to solve it?
 * This class basically makes the association between models AFTER sequelize has defined
 * the models, instead of at the same time. Models with associations should define an
 * associate function receving 'models' as params: (models) => { associations }. This class
 * loops through these models calling associate(models) for each of them.
 */

const Sequelize = require('sequelize');
const configFile = require('../config/config.js');

const config = configFile[process.env.NODE_ENV] || configFile.development;
config.logging = !process.env.SEQUELIZE_STATEMENT_LOGGING;

const db = {};
let sequelize;

console.log(`Trying with: ${[config.host, config.username].join(', ')}`);

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

db.Case = require('./case')(sequelize, Sequelize.DataTypes);
db.CaseAudit = require('./case-audit')(sequelize, Sequelize.DataTypes);
db.Contact = require('./contact')(sequelize, Sequelize.DataTypes);
db.CSAMReport = require('./csam-report')(sequelize, Sequelize.DataTypes);
db.PostSurvey = require('./post-survey')(sequelize, Sequelize.DataTypes);

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
