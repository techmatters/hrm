'use strict';
module.exports = (sequelize, DataTypes) => {
  // TODO(nick): Not sure we're supposed to get AgeBracket this way
  let Sequelize = require('sequelize')
  let AgeBracket = require('./agebracket')(sequelize, Sequelize)
  let Subcategory = require('./subcategory')(sequelize, Sequelize)
  const Contact = sequelize.define('Contact', {
    timestamp: DataTypes.BIGINT,
    taskId: DataTypes.STRING,
    reservationId: DataTypes.STRING,
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING
  }, {});
  Contact.belongsTo(AgeBracket);
  Contact.belongsTo(Subcategory);
  return Contact;
};