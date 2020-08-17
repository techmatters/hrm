const SequelizeMock = require('sequelize-mock');
const createCaseController = require('../../controllers/case-controller');

const DBConnectionMock = new SequelizeMock();
const MockCase = DBConnectionMock.define('Cases');
MockCase.findByPk = jest.fn(); // SequelizeMock doesn't define findByPk by itself

const CaseController = createCaseController(MockCase);

afterEach(() => jest.clearAllMocks());

test('create case', async () => {
  const createSpy = jest.spyOn(MockCase, 'create');

  const caseToBeCreated = {
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
  };

  await CaseController.createCase(caseToBeCreated);

  expect(createSpy).toHaveBeenCalledWith(caseToBeCreated);
});

test('get existing case', async () => {
  const caseId = 1;
  const caseFromDB = {
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
  };
  const findByPkSpy = jest.spyOn(MockCase, 'findByPk').mockImplementation(() => caseFromDB);

  const result = await CaseController.getCase(caseId);

  expect(findByPkSpy).toHaveBeenCalledWith(caseId);
  expect(result).toStrictEqual(caseFromDB);
});

test('get non existing case', async () => {
  const nonExistingCaseId = 1;
  jest.spyOn(MockCase, 'findByPk').mockImplementation(() => null);

  await expect(CaseController.getCase(nonExistingCaseId)).rejects.toThrow();
});

describe('Test listCases query params', () => {
  test('should use defaults limit and offset', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline' };

    await CaseController.listCases(queryParams);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: 'helpline',
      },
      limit: 1000,
      offset: 0,
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use limit 30 and default offset', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 30 };

    await CaseController.listCases(queryParams);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: 'helpline',
      },
      limit: 30,
      offset: 0,
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use default limit and offset 30', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', offset: 30 };

    await CaseController.listCases(queryParams);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: 'helpline',
      },
      limit: 1000,
      offset: 30,
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should use limit 30 and offset 30', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 30, offset: 30 };

    await CaseController.listCases(queryParams);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: 'helpline',
      },
      limit: 30,
      offset: 30,
    };

    expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  });

  test('should handle Nan limit', async () => {
    const findAndCountAllSpy = jest
      .spyOn(MockCase, 'findAndCountAll')
      .mockImplementation(() => ({ rows: [], count: 0 }));
    const queryParams = { helpline: 'helpline', limit: 'not a number' };

    await CaseController.listCases(queryParams);
    const expectedQueryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: 'helpline',
      },
      limit: 1000,
      offset: 0,
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
        info: { notes: 'Child with covid-19' },
        twilioWorkerId: 'twilio-worker-id',
      },
      getContacts() {
        return [
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
        ];
      },
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    const newItem = {
      ...dataValues,
      childName: 'name last',
      categories: { cat1: ['sub2'] },
    };
    return newItem;
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams);
  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      helpline: 'helpline',
    },
    limit: 1000,
    offset: 0,
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
        info: { notes: 'Child with covid-19' },
        twilioWorkerId: 'twilio-worker-id',
      },
      getContacts() {
        return [
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
        ];
      },
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    const newItem = {
      ...dataValues,
      childName: 'name last',
      categories: { cat1: ['sub2'] },
    };
    return newItem;
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline', limit: 20, offset: 30 };

  const result = await CaseController.listCases(queryParams);
  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      helpline: 'helpline',
    },
    limit: 20,
    offset: 30,
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
      getContacts() {
        return [];
      },
    },
  ];

  const expectedCases = casesFromDB.map(caseItem => {
    const { dataValues } = caseItem;
    const newItem = { ...dataValues, childName: '', categories: {} };
    return newItem;
  });

  const expected = { cases: expectedCases, count: expectedCases.length };

  const findAndCountAllSpy = jest
    .spyOn(MockCase, 'findAndCountAll')
    .mockImplementation(() => ({ rows: casesFromDB, count: casesFromDB.length }));
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams);

  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      helpline: 'helpline',
    },
    limit: 1000,
    offset: 0,
  };

  expect(findAndCountAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expected);
});

test('update existing case', async () => {
  const caseId = 1;
  const caseFromDB = {
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
    update: jest.fn(),
  };
  jest.spyOn(MockCase, 'findByPk').mockImplementation(() => caseFromDB);
  const updateSpy = jest.spyOn(caseFromDB, 'update');

  const updateCaseObject = {
    info: { notes: 'Refugee Child' },
  };

  await CaseController.updateCase(caseId, updateCaseObject);

  expect(updateSpy).toHaveBeenCalledWith(updateCaseObject);
});

test('update non existing case', async () => {
  const nonExsitingCaseId = 1;
  jest.spyOn(MockCase, 'findByPk').mockImplementation(() => null);

  const updateCaseObject = {
    info: { notes: 'Refugee Child' },
  };

  await expect(CaseController.updateCase(nonExsitingCaseId, updateCaseObject)).rejects.toThrow();
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
  jest.spyOn(MockCase, 'findByPk').mockImplementation(() => caseFromDB);
  const destroySpy = jest.spyOn(caseFromDB, 'destroy');

  await CaseController.deleteCase(caseId);

  expect(destroySpy).toHaveBeenCalled();
});

test('delete non existing case', async () => {
  const nonExsitingCaseId = 1;
  jest.spyOn(MockCase, 'findByPk').mockImplementation(() => null);

  await expect(CaseController.deleteCase(nonExsitingCaseId)).rejects.toThrow();
});
