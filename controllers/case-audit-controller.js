const { getActivity } = require('./activities');

const CaseAuditController = CaseAudit => {
  const getContactIdsFromCaseAudits = caseAudits => {
    return [...new Set(caseAudits.map(caseAudit => caseAudit.newValue.contacts).flat())];
  };

  const getAuditsForCase = async caseId => {
    const queryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        caseId,
      },
    };

    return CaseAudit.findAll(queryObject);
  };

  const getActivities = async (caseAudits, relatedContacts) => {
    const activities = [];

    caseAudits.forEach(caseAudit => {
      const activity = getActivity(caseAudit, relatedContacts);
      if (activity) activities.push(activity);
    });

    return activities;
  };

  const createCaseAuditFromContact = async (
    initialContactsFunction,
    contactInstance,
    caseFromDB,
    transaction,
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
      accountSid: contactInstance.dataValues.accountSid,
      previousValue,
      newValue,
    };

    await CaseAudit.create(caseAuditRecord, { transaction });
  };

  const createCaseAuditFromCase = async (previousValue, newValue, transaction) => {
    const caseAuditRecord = {
      caseId: newValue.id,
      twilioWorkerId: newValue.twilioWorkerId,
      accountSid: newValue.accountSid,
      previousValue,
      newValue,
    };
    await CaseAudit.create(caseAuditRecord, { transaction });
  };

  return {
    getAuditsForCase,
    getActivities,
    getContactIdsFromCaseAudits,
    createCaseAuditFromContact,
    createCaseAuditFromCase,
  };
};

module.exports = CaseAuditController;
