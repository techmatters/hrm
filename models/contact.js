const Sequelize = require('sequelize');
const ageBracket = require('./agebracket');
const subcategory = require('./subcategory');

module.exports = (sequelize, DataTypes) => {
  // TODO(nick): Not sure we're supposed to get AgeBracket this way
  const AgeBracketModel = ageBracket(sequelize, Sequelize);
  const SubcategoryModel = subcategory(sequelize, Sequelize);
  const Contact = sequelize.define('Contact', {
    timestamp: DataTypes.BIGINT,
    taskId: DataTypes.STRING,
    reservationId: DataTypes.STRING,
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING,
    conversationDuration: DataTypes.INTEGER,
  }, {});
  Contact.belongsTo(AgeBracketModel);
  Contact.belongsTo(SubcategoryModel);
  return Contact;
};
