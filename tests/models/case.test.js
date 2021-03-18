const models = require('../../models');
const { getHook, getMockedCaseInstance } = require('./utils');

const { Case } = models;
const workerSid = 'worker-sid';
const transaction= 'transaction-1';
const options = { transaction, context: { workerSid } };

test('afterCreate hook should create CaseAudit', async () => {
  const hook = getHook(Case, 'afterCreate', 'auditCaseHook');

  const dataValues = {
    id: 3,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes' },
    twilioWorkerId: 'worker-id',
    createdBy: workerSid,
  };
  const contactIds = [1, 2, 3];
  const caseInstance = getMockedCaseInstance({ dataValues, contactIds });

  const { CaseAudit } = caseInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  const expectedCaseAuditRecord = {
    caseId: 3,
    twilioWorkerId: 'worker-id',
    createdBy: workerSid,
    previousValue: null,
    newValue: {
      ...dataValues,
      contacts: contactIds,
    },
  };

  await hook(caseInstance, options);

  expect(createMethod).toHaveBeenCalledWith(expectedCaseAuditRecord, { transaction });
});

test('afterUpdate hook should create CaseAudit', async () => {
  const hook = getHook(Case, 'afterUpdate', 'auditCaseHook');

  const dataValues = {
    id: 3,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes' },
    twilioWorkerId: 'worker-id',
    createdBy: workerSid,
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
    createdBy: workerSid,
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

  expect(createMethod).toHaveBeenCalledWith(expectedCaseAuditRecord, { transaction });
});
