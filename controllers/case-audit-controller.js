const Sequelize = require('sequelize');

const { Op } = Sequelize;

const CaseAuditController = CaseAudit => {
  const getContactIdsFromCaseAudits = caseAudits => {
    return [...new Set(caseAudits.map(caseAudit => caseAudit.newValue.contacts).flat())];
  };

  const getAuditsForCase = async (caseId, accountSid) => {
    const queryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [caseId && { caseId }, accountSid && { accountSid }],
      },
    };

    return CaseAudit.findAll(queryObject);
  };

  const createCaseAuditFromContact = async (
    initialContactsFunction,
    contactInstance,
    caseFromDB,
    transaction,
    createdBy,
  ) => {
    if (!caseFromDB) return;

    const contacts = await caseFromDB.getConnectedContacts();
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
      createdBy,
      accountSid: contactInstance.dataValues.accountSid,
      previousValue,
      newValue,
    };

    await CaseAudit.create(caseAuditRecord, { transaction });
  };

  const createCaseAuditFromCase = async (previousValue, newValue, transaction, createdBy) => {
    const caseAuditRecord = {
      caseId: newValue.id,
      twilioWorkerId: newValue.twilioWorkerId,
      createdBy,
      accountSid: newValue.accountSid,
      previousValue,
      newValue,
    };
    await CaseAudit.create(caseAuditRecord, { transaction });
  };

  return {
    getAuditsForCase,
    getContactIdsFromCaseAudits,
    createCaseAuditFromContact,
    createCaseAuditFromCase,
  };
};

module.exports = CaseAuditController;
