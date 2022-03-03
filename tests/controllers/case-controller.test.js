const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const createCaseController = require('../../controllers/case-controller');

const DBConnectionMock = new SequelizeMock();
const MockCase = DBConnectionMock.define('Cases');

const { Op } = Sequelize;
const accountSid = 'account-sid';
const workerSid = 'worker-sid';

const CaseController = createCaseController(MockCase);

afterEach(() => jest.clearAllMocks());

test('create case', async () => {
  const createSpy = jest.spyOn(MockCase, 'create');

  const caseToBeCreated = {
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
    createdBy: workerSid,
    connectedContacts: [],
    accountSid,
  };

  await CaseController.createCase(caseToBeCreated, accountSid, workerSid);

  const options = {
    include: { association: 'connectedContacts', include: { association: 'csamReports' } },
    context: { workerSid },
  };
  expect(createSpy).toHaveBeenCalledWith(caseToBeCreated, options);
});

test('get existing case', async () => {
  const caseId = 1;
  const caseFromDB = {
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    },
    twilioWorkerId: 'twilio-worker-id',
  };
  const findOneSpy = jest.spyOn(MockCase, 'findOne').mockImplementation(() => caseFromDB);

  const result = await CaseController.getCase(caseId, accountSid);

  const options = {
    include: { association: 'connectedContacts', include: { association: 'csamReports' } },
    where: { [Op.and]: [{ id: caseId }, { accountSid }] },
  };
  expect(findOneSpy).toHaveBeenCalledWith(options);
  expect(result).toStrictEqual(caseFromDB);
});

test('get non existing case', async () => {
  const nonExistingCaseId = 1;
  jest.spyOn(MockCase, 'findOne').mockImplementation(() => null);

  await expect(CaseController.getCase(nonExistingCaseId, accountSid)).rejects.toThrow();
});

describe('Test listCases query params', () => {
  test('should use defaults limit and offset', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline' };

    await CaseController.listCases(queryParams, accountSid);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
      },
      limit: 1000,
      offset: 0,
      include: {
        association: 'connectedContacts',
        required: true,
        include: { association: 'csamReports' },
      },
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use limit 30 and default offset', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 30 };

    await CaseController.listCases(queryParams, accountSid);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
      },
      limit: 30,
      offset: 0,
      include: {
        association: 'connectedContacts',
        required: true,
        include: { association: 'csamReports' },
      },
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use default limit and offset 30', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', offset: 30 };

    await CaseController.listCases(queryParams, accountSid);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
      },
      limit: 1000,
      offset: 30,
      include: {
        association: 'connectedContacts',
        required: true,
        include: { association: 'csamReports' },
      },
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use limit 30 and offset 30', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 30, offset: 30 };

    await CaseController.listCases(queryParams, accountSid);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
      },
      limit: 30,
      offset: 30,
      include: {
        association: 'connectedContacts',
        required: true,
        include: { association: 'csamReports' },
      },
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should handle Nan limit', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 'not a number' };

    await CaseController.listCases(queryParams, accountSid);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
      },
      limit: 1000,
      offset: 0,
      include: {
        association: 'connectedContacts',
        required: true,
        include: { association: 'csamReports' },
      },
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });
});

test('list cases (with 1st contact, no limit/offset)', async () => {
  const caseId = 1;
  const casesFromDB = [
    {
      dataValues: {
        id: caseId,
        helpline: 'helpline',
        status: 'open',
        info: {
          counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
        },
        twilioWorkerId: 'twilio-worker-id',
      },
      connectedContacts: [
        {
          dataValues: {
            rawJson: {
              childInformation: { name: { firstName: 'name', lastName: 'last' } },
              caseInformation: {
                categories: {
                  cat1: { sub1: false, sub2: true },
                  cat2: { sub2: false, sub4: false },
                },
              },
            },
          },
        },
      ],
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    return {
      ...dataValues,
      info: {
        ...dataValues.info,
        notes: ['Child with covid-19'], // Legacy notes property
      },
      childName: 'name last',
      categories: { cat1: ['sub2'] },
    };
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams, accountSid);
  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
    },
    limit: 1000,
    offset: 0,
    include: {
      association: 'connectedContacts',
      required: true,
      include: { association: 'csamReports' },
    },
  };

  expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expected);
});

test('list cases (with 1st contact, with limit/offset)', async () => {
  const caseId = 1;
  const casesFromDB = [
    {
      dataValues: {
        id: caseId,
        helpline: 'helpline',
        status: 'open',
        info: {
          counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
        },
        twilioWorkerId: 'twilio-worker-id',
      },
      connectedContacts: [
        {
          dataValues: {
            rawJson: {
              childInformation: { name: { firstName: 'name', lastName: 'last' } },
              caseInformation: {
                categories: {
                  cat1: { sub1: false, sub2: true },
                  cat2: { sub2: false, sub4: false },
                },
              },
            },
          },
        },
      ],
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    return {
      ...dataValues,
      info: {
        ...dataValues.info,
        notes: ['Child with covid-19'], // Legacy notes property
      },
      childName: 'name last',
      categories: { cat1: ['sub2'] },
    };
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline', limit: 20, offset: 30 };

  const result = await CaseController.listCases(queryParams, accountSid);
  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
    },
    limit: 20,
    offset: 30,
    include: {
      association: 'connectedContacts',
      required: true,
      include: { association: 'csamReports' },
    },
  };

  expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expected);
});

test('list cases (without contacts)', async () => {
  const caseId = 1;
  const casesFromDB = [
    {
      dataValues: {
        id: caseId,
        helpline: 'helpline',
        status: 'open',
        info: { notes: 'Child with covid-19' },
        twilioWorkerId: 'twilio-worker-id',
      },
      connectedContacts: [],
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    return { ...dataValues, childName: '', categories: {} };
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams, accountSid);

  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      [Op.and]: [{ helpline: 'helpline' }, { accountSid }],
    },
    limit: 1000,
    offset: 0,
    include: {
      association: 'connectedContacts',
      required: true,
      include: { association: 'csamReports' },
    },
  };

  expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expected);
});

test('list cases without helpline', async () => {
  const findAndCountAllSpy = jest.spyOn(MockCase, 'findAndCountAll');
  const queryParams = { limit: 20, offset: 30 };
  await CaseController.listCases(queryParams, accountSid);
  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      [Op.and]: [undefined, { accountSid }],
    },
    limit: 20,
    offset: 30,
    include: {
      association: 'connectedContacts',
      required: true,
      include: { association: 'csamReports' },
    },
  };

  expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
});
describe('update existing case', () => {
  const mockExistingCase = expectedCaseInfo => {
    const caseId = 1;
    const caseFromDB = {
      dataValues: {
        id: caseId,
        helpline: 'helpline',
        status: 'open',
        info: expectedCaseInfo,
        twilioWorkerId: 'twilio-worker-id',
        createdBy: workerSid,
      },
      update: jest.fn(),
    };
    jest.spyOn(MockCase, 'findOne').mockImplementation(() => caseFromDB);
    return caseFromDB;
  };

  const mockUpdatedCase = (updatedCaseInfo, caseFromDB) => {
    const updateCaseObject = {
      info: updatedCaseInfo,
    };
    const updateSpy = jest
      .spyOn(caseFromDB, 'update')
      .mockImplementation(() => ({ dataValues: updateCaseObject }));
    return { updateCaseObject, updateSpy };
  };

  test('using current format', async () => {
    const caseFromDB = mockExistingCase({
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    });

    const { updateCaseObject, updateSpy } = mockUpdatedCase(
      {
        counsellorNotes: [{ note: 'Refugee Child', twilioWorkerId: 'contact-adder' }],
      },
      caseFromDB,
    );

    const returned = await CaseController.updateCase(
      caseFromDB.dataValues.id,
      updateCaseObject,
      accountSid,
      workerSid,
    );

    const contextObject = { context: { workerSid } };
    expect(updateSpy).toHaveBeenCalledWith(updateCaseObject, contextObject);
    expect(returned.info).toStrictEqual({
      ...updateCaseObject.info,
      notes: ['Refugee Child'],
    });
  });

  test('adding a note in legacy note format - converts legacy note to counsellor note', async () => {
    const caseFromDB = mockExistingCase({
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    });

    const { updateCaseObject, updateSpy } = mockUpdatedCase(
      {
        counsellorNotes: [
          { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
          { note: 'Refugee Child', twilioWorkerId: workerSid, createdAt: expect.anything() },
        ],
      },
      caseFromDB,
    );
    const contextObject = { context: { workerSid } };

    const legacyUpdateCaseObject = {
      info: { notes: ['Child with covid-19', 'Refugee Child'] },
    };

    const returned = await CaseController.updateCase(
      caseFromDB.dataValues.id,
      legacyUpdateCaseObject,
      accountSid,
      workerSid,
    );

    expect(updateSpy).toHaveBeenCalledWith(updateCaseObject, contextObject);
    expect(returned.info).toStrictEqual({
      ...updateCaseObject.info,
      notes: ['Child with covid-19', 'Refugee Child'],
    });
  });

  test('adding a referral in legacy format - adds missing properties', async () => {
    const caseFromDB = mockExistingCase({
      referrals: [
        {
          date: '2020-10-15',
          referredTo: 'State Agency 1',
          comments: 'comment',
          createdAt: '2020-10-16 00:00:00',
          twilioWorkerId: 'referral-adder',
        },
      ],
    });

    const { updateCaseObject, updateSpy } = mockUpdatedCase(
      {
        referrals: [
          {
            date: '2020-10-15',
            referredTo: 'State Agency 1',
            comments: 'comment',
            createdAt: '2020-10-16 00:00:00',
            twilioWorkerId: 'referral-adder',
          },
          {
            date: '2020-10-16',
            referredTo: 'State Agency 2',
            comments: 'comment',
            createdAt: expect.anything(),
            twilioWorkerId: workerSid,
          },
        ],
      },
      caseFromDB,
    );
    const contextObject = { context: { workerSid } };

    const legacyUpdateCaseObject = {
      info: {
        referrals: [
          {
            date: '2020-10-15',
            referredTo: 'State Agency 1',
            comments: 'comment',
            createdAt: '2020-10-16 00:00:00',
            twilioWorkerId: 'referral-adder',
          },
          {
            date: '2020-10-16',
            referredTo: 'State Agency 2',
            comments: 'comment',
          },
        ],
      },
    };

    const returned = await CaseController.updateCase(
      caseFromDB.dataValues.id,
      legacyUpdateCaseObject,
      accountSid,
      workerSid,
    );

    expect(updateSpy).toHaveBeenCalledWith(updateCaseObject, contextObject);
    expect(returned.info).toStrictEqual(updateCaseObject.info);
  });

  test('update an existing referral in legacy referral format - does not overwrite preexisting new properties', async () => {
    const caseFromDB = mockExistingCase({
      referrals: [
        {
          date: '2020-10-15',
          referredTo: 'State Agency 1',
          comments: 'comment',
          createdAt: '2020-10-16 00:00:00',
          twilioWorkerId: 'referral-adder',
        },
      ],
    });

    const { updateCaseObject, updateSpy } = mockUpdatedCase(
      {
        referrals: [
          {
            date: '2020-10-15',
            referredTo: 'State Agency 1',
            comments: 'changed comment',
            createdAt: '2020-10-16 00:00:00',
            twilioWorkerId: 'referral-adder',
          },
          {
            date: '2020-10-16',
            referredTo: 'State Agency 2',
            comments: 'comment',
            createdAt: expect.anything(),
            twilioWorkerId: workerSid,
          },
        ],
      },
      caseFromDB,
    );
    const contextObject = { context: { workerSid } };

    const legacyUpdateCaseObject = {
      info: {
        referrals: [
          {
            date: '2020-10-15',
            referredTo: 'State Agency 1',
            comments: 'changed comment',
          },
          {
            date: '2020-10-16',
            referredTo: 'State Agency 2',
            comments: 'comment',
          },
        ],
      },
    };

    const returned = await CaseController.updateCase(
      caseFromDB.dataValues.id,
      legacyUpdateCaseObject,
      accountSid,
      workerSid,
    );

    expect(updateSpy).toHaveBeenCalledWith(updateCaseObject, contextObject);
    expect(returned.info).toStrictEqual(updateCaseObject.info);
  });
});

test('update non existing case', async () => {
  const nonExistingCaseId = 1;
  jest.spyOn(MockCase, 'findOne').mockImplementation(() => null);

  const updateCaseObject = {
    info: { notes: 'Refugee Child' },
  };

  await expect(
    CaseController.updateCase(nonExistingCaseId, updateCaseObject, accountSid, workerSid),
  ).rejects.toThrow();
});

test('delete existing case', async () => {
  const caseId = 1;
  const caseFromDB = {
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
    destroy: jest.fn(),
  };
  jest.spyOn(MockCase, 'findOne').mockImplementation(() => caseFromDB);
  const destroySpy = jest.spyOn(caseFromDB, 'destroy');

  await CaseController.deleteCase(caseId, accountSid);

  expect(destroySpy).toHaveBeenCalled();
});

test('delete non existing case', async () => {
  const nonExsitingCaseId = 1;
  jest.spyOn(MockCase, 'findOne').mockImplementation(() => null);

  await expect(CaseController.deleteCase(nonExsitingCaseId, accountSid)).rejects.toThrow();
});
