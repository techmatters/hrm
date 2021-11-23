module.exports = (sequelize, DataTypes) => {
  const CSAMReport = sequelize.define('CSAMReport', {
    accountSid: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING, // The worker who submited the report
    csamReportId: DataTypes.STRING, // The id returned from the exteral API (like IWF)
    contactId: DataTypes.INTEGER, // The contact associated to this report (if any)
  });

  CSAMReport.associate = models => {
    CSAMReport.belongsTo(models.Contact, { foreignKey: 'contactId' });
  };

  return CSAMReport;
};
