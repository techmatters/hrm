const getHook = (model, hookType, name) =>
  model.options.hooks[hookType].find(hook => hook.name === name).fn;

const getMockedCaseInstance = ({ dataValues, previousValues, contactIds }) => {
  const CaseAudit = {
    create: jest.fn(),
  };
  const getContactWithId = id => ({ dataValues: { id } });
  const getConnectedContacts = () => contactIds.map(id => getContactWithId(id));
  const previous = () => previousValues;

  return {
    sequelize: {
      models: { CaseAudit },
    },
    dataValues,
    previous,
    getConnectedContacts,
  };
};

const getMockedContactInstance = ({ contactId, twilioWorkerId, createdBy, previousCase, newCase }) => {
  const CaseAudit = {
    create: jest.fn(),
  };
  const Case = {
    findAll: () => (previousCase ? [previousCase, newCase] : [newCase]),
  };
  const previous = () => (previousCase ? previousCase.dataValues.id : null);

  return {
    sequelize: {
      models: { CaseAudit, Case },
    },
    dataValues: {
      id: contactId,
      caseId: newCase.dataValues.id,
      twilioWorkerId,
      createdBy
    },
    previous,
  };
};

module.exports = { getHook, getMockedCaseInstance, getMockedContactInstance };
