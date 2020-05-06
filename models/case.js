module.exports = (sequelize, DataTypes) => {
  const Case = sequelize.define('Case', {
    status: DataTypes.STRING,
    helpline: DataTypes.STRING,
    info: DataTypes.JSONB,
  });

  Case.associate = models => Case.hasMany(models.Contact, { foreignKey: 'caseId' });

  return Case;
};
