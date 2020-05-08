module.exports = (sequelize, DataTypes) => {
  const Case = sequelize.define('Case', {
    status: DataTypes.STRING,
    helpline: DataTypes.STRING,
    info: DataTypes.JSONB,
    twilioWorkerId: DataTypes.STRING,
  });

  Case.associate = models => {
    Case.hasMany(models.Contact, { foreignKey: 'caseId' });
    Case.hasMany(models.CaseAudit, { foreignKey: 'caseId' });
  };

  Case.afterUpdate('auditCaseHook', async (caseInstance, options) => {
    const contacts = await caseInstance.getContacts();
    const contactsId = contacts.map(contact => contact.dataValues.id);
    const previousValue = {
      // eslint-disable-next-line no-underscore-dangle
      ...caseInstance._previousDataValues,
      contacts: contactsId,
    };
    const newValue = {
      ...caseInstance.dataValues,
      contacts: contactsId,
    };
    const caseAuditRecord = {
      caseId: newValue.id,
      twilioWorkerId: newValue.twilioWorkerId,
      previousValue,
      newValue,
    };
    const { CaseAudit } = caseInstance.sequelize.models;
    await CaseAudit.create(caseAuditRecord, {
      transaction: options.transaction,
    });
  });

  return Case;
};
