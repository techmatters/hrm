module.exports = (sequelize, DataTypes) => {
  const CSAMReport = sequelize.define('CSAMReport', {
    accountSid: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING, // The worker who submited the report
    contactTaskId: DataTypes.STRING, // The contact associated to this report (if any)
    csamReportId: DataTypes.STRING, // The id returned from the exteral API (like IWF)
  });

  CSAMReport.associate = models => {
    CSAMReport.belongsTo(models.Contact, { foreingKey: 'contactTaskId' });
  };

  return CSAMReport;
};
