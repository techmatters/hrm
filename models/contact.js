module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    taskId: DataTypes.STRING,
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING,
    conversationDuration: DataTypes.INTEGER,
  });

  Contact.associate = models => Contact.belongsTo(models.Case, { foreignKey: 'caseId' });

  return Contact;
};
