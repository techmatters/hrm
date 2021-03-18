// Can't import CaseAudit model before Sequelize has initiated, so we import the controller creator and provide the CaseAudit model in runtime
const CaseAuditControllerCreator = require('../controllers/case-audit-controller');

const getContactIds = async caseInstance => {
  const contacts = await caseInstance.getConnectedContacts();
  return contacts.map(contact => contact.dataValues.id);
};

module.exports = (sequelize, DataTypes) => {
  const Case = sequelize.define('Case', {
    status: DataTypes.STRING,
    helpline: DataTypes.STRING,
    info: DataTypes.JSONB,
    twilioWorkerId: DataTypes.STRING,
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    accountSid: DataTypes.STRING,
  });

  Case.associate = models => {
    Case.hasMany(models.Contact, { foreignKey: 'caseId', as: 'connectedContacts' });
    Case.hasMany(models.CaseAudit, { foreignKey: 'caseId' });
  };

  Case.afterCreate('auditCaseHook', async (caseInstance, options) => {
    const { context } = options;

    const { CaseAudit } = caseInstance.sequelize.models;
    const { createCaseAuditFromCase } = CaseAuditControllerCreator(CaseAudit);
    const contactIds = await getContactIds(caseInstance);
    const previousValue = null;
    const newValue = {
      ...caseInstance.dataValues,
      contacts: contactIds,
    };

    await createCaseAuditFromCase(previousValue, newValue, options.transaction, context.workerSid);
  });

  Case.afterUpdate('auditCaseHook', async (caseInstance, options) => {
    const { context } = options;

    const { CaseAudit } = caseInstance.sequelize.models;
    const { createCaseAuditFromCase } = CaseAuditControllerCreator(CaseAudit);
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

    await createCaseAuditFromCase(previousValue, newValue, options.transaction, context.workerSid);
  });

  return Case;
};
