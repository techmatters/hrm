module.exports = (sequelize, DataTypes) => {
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
  });

  Contact.associate = models => {
    Contact.belongsTo(models.Case, { foreignKey: 'caseId' });
    Contact.belongsTo(models.AgeBracket, { foreignKey: 'AgeBracketId' });
    Contact.belongsTo(models.Subcategory, { foreignKey: 'SubcategoryId' });
  };

  return Contact;
};
