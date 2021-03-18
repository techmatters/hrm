const models = require('../../models');
const { getHook, getMockedCaseInstance, getMockedContactInstance } = require('./utils');

const { Contact } = models;
const workerSid = 'worker-sid';
const options = { transaction: 'transaction-1', context: { workerSid } };

test('afterUpdate hook should create two CaseAudit', async () => {
  const hook = getHook(Contact, 'afterUpdate', 'auditCaseHook');
  const twilioWorkerId = 'worker-id';

  const contactId = 5;
  const previousCaseDataValues = {
    id: 1,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes from previous case' },
    twilioWorkerId,
    createdBy: workerSid,
  };
  const newCaseDataValues = {
    id: 2,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes from new case' },
    twilioWorkerId,
    createdBy: workerSid,
  };
  const previousCase = getMockedCaseInstance({
    dataValues: previousCaseDataValues,
    previousValues: previousCaseDataValues,
    contactIds: [1, 2], // contacts after the update
  });
  const newCase = getMockedCaseInstance({
    dataValues: newCaseDataValues,
    previousValues: newCaseDataValues,
    contactIds: [8, 9, contactId], // contacts after the update
  });
  const contactInstance = getMockedContactInstance({
    contactId,
    twilioWorkerId,
    createdBy: workerSid,
    previousCase,
    newCase,
  });

  const { CaseAudit } = contactInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  const expectedPreviousCaseAuditRecord = {
    caseId: 1,
    twilioWorkerId,
    createdBy: workerSid,
    previousValue: {
      ...previousCaseDataValues,
      contacts: [1, 2, contactId],
    },
    newValue: {
      ...previousCaseDataValues,
      contacts: [1, 2],
    },
  };

  const expectedNewCaseAuditRecord = {
    caseId: 2,
    twilioWorkerId,
    createdBy: workerSid,
    previousValue: {
      ...newCaseDataValues,
      contacts: [8, 9],
    },
    newValue: {
      ...newCaseDataValues,
      contacts: [8, 9, contactId],
    },
  };

  await hook(contactInstance, options);

  expect(createMethod).toHaveBeenCalledTimes(2);
  expect(createMethod).toHaveBeenNthCalledWith(1, expectedPreviousCaseAuditRecord, options);
  expect(createMethod).toHaveBeenNthCalledWith(2, expectedNewCaseAuditRecord, options);
});

test('afterUpdate hook should create only one CaseAudits', async () => {
  const hook = getHook(Contact, 'afterUpdate', 'auditCaseHook');
  const twilioWorkerId = 'worker-id';

  const contactId = 5;
  const newCaseDataValues = {
    id: 2,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes from new case' },
    twilioWorkerId,
    createdBy: workerSid,
  };
  const newCase = getMockedCaseInstance({
    dataValues: newCaseDataValues,
    previousValues: newCaseDataValues,
    contactIds: [8, 9, contactId], // contacts after the update
  });
  const contactInstance = getMockedContactInstance({
    contactId,
    twilioWorkerId,
    createdBy: workerSid,
    previousCase: null,
    newCase,
  });

  const { CaseAudit } = contactInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  const expectedNewCaseAuditRecord = {
    caseId: 2,
    twilioWorkerId,
    createdBy: workerSid,
    previousValue: {
      ...newCaseDataValues,
      contacts: [8, 9],
    },
    newValue: {
      ...newCaseDataValues,
      contacts: [8, 9, contactId],
    },
  };

  await hook(contactInstance, options);

  expect(createMethod).toHaveBeenCalledTimes(1);
  expect(createMethod).toHaveBeenNthCalledWith(1, expectedNewCaseAuditRecord, options);
});

test('afterUpdate hook should create no CaseAudits', async () => {
  const hook = getHook(Contact, 'afterUpdate', 'auditCaseHook');
  const twilioWorkerId = 'worker-id';

  const contactId = 5;
  const previousCaseDataValues = {
    id: 1,
    status: 'open',
    helpline: 'helpline',
    info: { notes: 'notes from previous case' },
    twilioWorkerId,
    createdBy: workerSid,
  };
  const previousCase = getMockedCaseInstance({
    dataValues: previousCaseDataValues,
    previousValues: previousCaseDataValues,
    contactIds: [1, 2], // contacts after the update
  });
  const contactInstance = getMockedContactInstance({
    contactId,
    twilioWorkerId,
    createdBy: workerSid,
    previousCase,
    newCase: previousCase, // didn't change connected case
  });

  const { CaseAudit } = contactInstance.sequelize.models;
  const createMethod = jest.spyOn(CaseAudit, 'create');

  await hook(contactInstance, options);

  expect(createMethod).not.toHaveBeenCalled();
});
