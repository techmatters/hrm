const Sequelize = require('sequelize');
// Can't import CaseAudit model before Sequelize has initiated, so we import the controller creator and provide the CaseAudit model in runtime
const CaseAuditControllerCreator = require('../controllers/case-audit-controller');

const { Op } = Sequelize;

const getPreviousAndNewCases = async (contactInstance, transaction) => {
  const { Case } = contactInstance.sequelize.models;
  const previousCaseId = contactInstance.previous('caseId');
  const newCaseId = contactInstance.dataValues.caseId;

  const casesFromDB = await Case.findAll(
    {
      where: { id: { [Op.in]: [previousCaseId, newCaseId] } },
    },
    { transaction },
  );

  const previousCase = previousCaseId && casesFromDB.find(c => c.dataValues.id === previousCaseId);
  const newCase = newCaseId && casesFromDB.find(c => c.dataValues.id === newCaseId);

  return [previousCase, newCase];
};

const auditDisconnectContact = async (contactInstance, caseFromDB, transaction, workerSid) => {
  const { CaseAudit } = contactInstance.sequelize.models;
  const { createCaseAuditFromContact } = CaseAuditControllerCreator(CaseAudit);
  const initialContactsFunction = (currentContactIds, id) => [...currentContactIds, id];

  await createCaseAuditFromContact(
    initialContactsFunction,
    contactInstance,
    caseFromDB,
    transaction,
    workerSid,
  );
};

const auditConnectContact = async (contactInstance, caseFromDB, transaction, workerSid) => {
  const { CaseAudit } = contactInstance.sequelize.models;
  const { createCaseAuditFromContact } = CaseAuditControllerCreator(CaseAudit);
  const initialContactsFunction = (currentContactIds, id) =>
    currentContactIds.filter(e => e !== id);

  await createCaseAuditFromContact(
    initialContactsFunction,
    contactInstance,
    caseFromDB,
    transaction,
    workerSid,
  );
};

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING,
    conversationDuration: DataTypes.INTEGER,
    accountSid: DataTypes.STRING,
    timeOfContact: DataTypes.DATE,
    taskId: DataTypes.STRING,
    channelSid: DataTypes.STRING,
    serviceSid: DataTypes.STRING,
  });

  Contact.associate = models => {
    Contact.belongsTo(models.Case, { foreignKey: 'caseId' });
    Contact.hasMany(models.PostSurvey, { foreignKey: 'contactTaskId' });
    Contact.hasMany(models.CSAMReport, { foreignKey: 'contactId' });
  };

  /**
   * Whenever a contact gets connected to a case, a CaseAudit record should be created
   * to track this new association. It should also record disassociations between contacts
   * and cases.
   */
  Contact.afterUpdate('auditCaseHook', async (contactInstance, options) => {
    const noCaseIdChange = contactInstance.previous('caseId') === contactInstance.dataValues.caseId;

    if (noCaseIdChange) return;

    const { context } = options;

    const [previousCase, newCase] = await getPreviousAndNewCases(contactInstance);
    await auditDisconnectContact(
      contactInstance,
      previousCase,
      options.transaction,
      context.workerSid,
    );
    await auditConnectContact(contactInstance, newCase, options.transaction, context.workerSid);
  });

  return Contact;
};
