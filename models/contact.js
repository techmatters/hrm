'use strict';
module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    taskId: DataTypes.STRING,
    reservationId: DataTypes.STRING,
    ageBracketId: DataTypes.INTEGER
  }, {});
  Contact.hasOne(AgeBracket);
  return Contact;
};