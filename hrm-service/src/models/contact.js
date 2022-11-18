const Sequelize = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    updatedBy: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING,
    conversationDuration: DataTypes.INTEGER,
    accountSid: DataTypes.STRING,
    timeOfContact: DataTypes.DATE,
    taskId: DataTypes.STRING,
    channelSid: DataTypes.STRING,
    serviceSid: DataTypes.STRING,
  });

  Contact.associate = models => {
    Contact.hasMany(models.PostSurvey, { foreignKey: 'contactTaskId' });
  };

  return Contact;
};
