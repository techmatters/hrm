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

test('list cases (with 1st contact)', async () => {
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
                  callSummary: 'summary',
                  categories: { some: 'some', thing: 'thing' },
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
      callSummary: 'summary',
      categories: { some: 'some', thing: 'thing' },
    };
    return newItem;
  });

  const findAllSpy = jest.spyOn(MockCase, 'findAll').mockImplementation(() => casesFromDB);
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams);

  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      helpline: 'helpline',
    },
  };

  expect(findAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expectedCases);
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
    const newItem = { ...dataValues, childName: '', callSummary: '', categories: null };
    return newItem;
  });

  const findAllSpy = jest.spyOn(MockCase, 'findAll').mockImplementation(() => casesFromDB);
  const queryParams = { helpline: 'helpline' };

  const result = await CaseController.listCases(queryParams);

  const expectedQueryObject = {
    order: [['createdAt', 'DESC']],
    where: {
      helpline: 'helpline',
    },
  };

  expect(findAllSpy).toHaveBeenCalledWith(expectedQueryObject);
  expect(result).toStrictEqual(expectedCases);
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
