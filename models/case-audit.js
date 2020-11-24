module.exports = (sequelize, DataTypes) => {
  const CaseAudit = sequelize.define('CaseAudit', {
    twilioWorkerId: DataTypes.STRING,
    previousValue: DataTypes.JSONB,
    newValue: DataTypes.JSONB,
    /**
     * In theory, we shouldn't need to explicitly declare 'caseId' here,
     * since the association CaseAudit.belongsTo(Case) would handle it.
     * But sequelize was NOT inserting 'caseId' when CREATING a CaseAudit.
     */
    caseId: DataTypes.INTEGER,
    accountSid: DataTypes.STRING,
  });

  CaseAudit.associate = models => CaseAudit.belongsTo(models.Case, { foreignKey: 'caseId' });

  return CaseAudit;
};
