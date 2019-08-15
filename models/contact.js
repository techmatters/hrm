'use strict';
module.exports = (sequelize, DataTypes) => {
  // TODO(nick): Not sure we're supposed to get AgeBracket this way
  let Sequelize = require('sequelize')
  let AgeBracket = require('./agebracket')(sequelize, Sequelize)
  let Subcategory = require('./subcategory')(sequelize, Sequelize)
  const Contact = sequelize.define('Contact', {
    timestamp: DataTypes.BIGINT,
    taskId: DataTypes.STRING,
    reservationId: DataTypes.STRING
  }, {});
  Contact.belongsTo(AgeBracket);
  Contact.belongsTo(Subcategory);
  return Contact;
};