// eslint-disable-next-line import/no-unresolved
const models = require('../../models');
const { getHook, getMockedCaseInstance } = require('./utils');

const { Case } = models;
const options = { transaction: 'transaction-1' };

test('afterCreate hook should create CaseAudit', async () => {
  const hook = getHook(Case, 'afterCreate', 'auditCaseHook');

  const dataValues = {
    id: 3,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes' },
    twilioWorkerId: 'worker-id',
  };
  const contactIds = [1, 2, 3];
  const caseInstance = getMockedCaseInstance({ dataValues, contactIds });

  const { CaseAudit } = caseInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  const expectedCaseAuditRecord = {
    caseId: 3,
    twilioWorkerId: 'worker-id',
    previousValue: null,
    newValue: {
      ...dataValues,
      contacts: contactIds,
    },
  };

  await hook(caseInstance, options);

  expect(createMethod).toHaveBeenCalledWith(expectedCaseAuditRecord, options);
});

test('afterUpdate hook should create CaseAudit', async () => {
  const hook = getHook(Case, 'afterUpdate', 'auditCaseHook');

  const dataValues = {
    id: 3,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes' },
    twilioWorkerId: 'worker-id',
  };
  const previousValues = {
    ...dataValues,
    info: { notes: 'updated notes' },
  };
  const contactIds = [1, 2, 3];
  const caseInstance = getMockedCaseInstance({ dataValues, previousValues, contactIds });

  const { CaseAudit } = caseInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  const expectedCaseAuditRecord = {
    caseId: 3,
    twilioWorkerId: 'worker-id',
    previousValue: {
      ...previousValues,
      contacts: contactIds,
    },
    newValue: {
      ...dataValues,
      contacts: contactIds,
    },
  };

  await hook(caseInstance, options);

  expect(createMethod).toHaveBeenCalledWith(expectedCaseAuditRecord, options);
});
