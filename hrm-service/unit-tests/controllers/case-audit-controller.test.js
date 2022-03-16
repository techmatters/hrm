const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const createCaseAuditController = require('../../src/controllers/case-audit-controller');

const DBConnectionMock = new SequelizeMock();
const MockCaseAudit = DBConnectionMock.define('CaseAudits');

jest.mock('../../src/controllers/activities');

const { Op } = Sequelize;
const accountSid = 'account-sid';

const CaseAuditController = createCaseAuditController(MockCaseAudit);

afterEach(() => jest.clearAllMocks());

test('getAuditsForCase', async () => {
  const caseId = 1;
  const caseAudits = [
    {
      id: 1,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: null,
      newValue: {
        contacts: [],
      },
    },
    {
      id: 2,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        contacts: [],
        info: {},
      },
      newValue: {
        contacts: [123],
      },
    },
  ];
  const findAllSpy = jest
    .spyOn(MockCaseAudit, 'findAll')
    .mockReturnValue(Promise.resolve(caseAudits));

  const result = await CaseAuditController.getAuditsForCase(caseId, accountSid);

  const expectedQuery = {
    order: [['createdAt', 'DESC']],
    where: {
      [Op.and]: [{ caseId }, { accountSid }],
    },
  };

  expect(findAllSpy).toHaveBeenCalledWith(expectedQuery);
  expect(result).toStrictEqual(caseAudits);
});
