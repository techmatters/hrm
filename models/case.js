const createCaseAudit = async (CaseAudit, previousValue, newValue, transaction) => {
  const caseAuditRecord = {
    caseId: newValue.id,
    twilioWorkerId: newValue.twilioWorkerId,
    previousValue,
    newValue,
  };
  await CaseAudit.create(caseAuditRecord, { transaction });
};

const getContactIds = async caseInstance => {
  const contacts = await caseInstance.getContacts();
  return contacts.map(contact => contact.dataValues.id);
};

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

  Case.afterCreate('auditCaseHook', async (caseInstance, options) => {
    const { CaseAudit } = caseInstance.sequelize.models;
    const contactIds = await getContactIds(caseInstance);
    const previousValue = null;
    const newValue = {
      ...caseInstance.dataValues,
      contacts: contactIds,
    };

    await createCaseAudit(CaseAudit, previousValue, newValue, options.transaction);
  });

  Case.afterUpdate('auditCaseHook', async (caseInstance, options) => {
    const { CaseAudit } = caseInstance.sequelize.models;
    const contactIds = await getContactIds(caseInstance);
    const previousValue = {
      ...caseInstance.dataValues,
      ...caseInstance.previous(),
      contacts: contactIds,
    };
    const newValue = {
      ...caseInstance.dataValues,
      contacts: contactIds,
    };

    await createCaseAudit(CaseAudit, previousValue, newValue, options.transaction);
  });

  return Case;
};
