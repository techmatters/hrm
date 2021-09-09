module.exports = (sequelize, DataTypes) => {
  const PostSurvey = sequelize.define('PostSurvey', {
    contactTaskId: DataTypes.STRING,
    accountSid: DataTypes.STRING,
    taskId: DataTypes.STRING,
    data: DataTypes.JSONB,
  });

  PostSurvey.associate = models =>
    PostSurvey.belongsTo(models.Contact, { foreignKey: 'contactTaskId' });

  return PostSurvey;
};
