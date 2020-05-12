const Sequelize = require('sequelize');

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

const createCaseAudit = async (
  initialContactsFunction,
  contactInstance,
  caseFromDB,
  transaction,
) => {
  if (!caseFromDB) return;

  const { CaseAudit } = contactInstance.sequelize.models;
  const contacts = await caseFromDB.getContacts();
  const contactsId = contacts.map(contact => contact.dataValues.id);
  const previousValue = {
    ...caseFromDB.dataValues,
    contacts: initialContactsFunction(contactsId, contactInstance.dataValues.id),
  };
  const newValue = {
    ...caseFromDB.dataValues,
    contacts: contactsId,
  };
  const caseAuditRecord = {
    caseId: caseFromDB.dataValues.id,
    twilioWorkerId: contactInstance.dataValues.twilioWorkerId,
    previousValue,
    newValue,
  };

  await CaseAudit.create(caseAuditRecord, { transaction });
};

const auditDisconnectContact = async (contactInstance, caseFromDB, transaction) => {
  const initialContactsFunction = (currentContactsId, id) => [...currentContactsId, id];
  await createCaseAudit(initialContactsFunction, contactInstance, caseFromDB, transaction);
};

const auditConnectContact = async (contactInstance, caseFromDB, transaction) => {
  const initialContactsFunction = (currentContactsId, id) =>
    currentContactsId.filter(e => e !== id);
  await createCaseAudit(initialContactsFunction, contactInstance, caseFromDB, transaction);
};

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    taskId: DataTypes.STRING,
    rawJson: DataTypes.JSON,
    queueName: DataTypes.STRING,
    twilioWorkerId: DataTypes.STRING,
    helpline: DataTypes.STRING,
    number: DataTypes.STRING,
    channel: DataTypes.STRING,
    conversationDuration: DataTypes.INTEGER,
  });

  Contact.associate = models => Contact.belongsTo(models.Case, { foreignKey: 'caseId' });

  /**
   * Whenever a contact gets connected to a case, a CaseAudit record should be created
   * to track this new association. It should also record disassociations between contacts
   * and cases.
   */
  Contact.afterUpdate('auditCaseHook', async (contactInstance, options) => {
    const noCaseIdChange = contactInstance.previous('caseId') === contactInstance.dataValues.caseId;

    if (noCaseIdChange) return;

    const [previousCase, newCase] = await getPreviousAndNewCases(contactInstance);
    await auditDisconnectContact(contactInstance, previousCase, options.transaction);
    await auditConnectContact(contactInstance, newCase, options.transaction);
  });

  return Contact;
};
