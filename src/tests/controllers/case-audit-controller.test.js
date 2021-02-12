const SequelizeMock = require('sequelize-mock');
const { getActivity } = require('../../controllers/activities');
const createCaseAuditController = require('../../controllers/case-audit-controller');

const DBConnectionMock = new SequelizeMock();
const MockCaseAudit = DBConnectionMock.define('CaseAudits');

jest.mock('../../controllers/activities');

const CaseAuditController = createCaseAuditController(MockCaseAudit);

afterEach(() => jest.clearAllMocks());

test('getContactIdsFromCaseAudits', () => {
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
      },
      newValue: {
        contacts: [123],
      },
    },
    {
      id: 3,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        contacts: [123],
      },
      newValue: {
        contacts: [123, 124],
      },
    },
    {
      id: 4,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        contacts: [123, 124],
      },
      newValue: {
        contacts: [123, 124],
        info: {
          notes: ['One note'],
        },
      },
    },
  ];

  const result = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);

  const expectedContactIds = [123, 124];
  expect(result).toStrictEqual(expectedContactIds);
});

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

  const result = await CaseAuditController.getAuditsForCase(caseId);

  const expectedQuery = {
    order: [['createdAt', 'DESC']],
    where: {
      caseId,
    },
  };

  expect(findAllSpy).toHaveBeenCalledWith(expectedQuery);
  expect(result).toStrictEqual(caseAudits);
});

test('getActivities', async () => {
  const caseAudit1 = {
    id: 1,
    twilioWorkerId: 'twilio-worker-id',
    previousValue: null,
    newValue: {
      contacts: [],
    },
  };
  const caseAudit2 = {
    id: 2,
    twilioWorkerId: 'twilio-worker-id',
    previousValue: {
      contacts: [],
    },
    newValue: {
      contacts: [123],
    },
  };
  const relatedContacts = [{ id: 123 }];
  await CaseAuditController.getActivities([caseAudit1, caseAudit2], relatedContacts);

  expect(getActivity).toHaveBeenNthCalledWith(1, caseAudit1, relatedContacts);
  expect(getActivity).toHaveBeenNthCalledWith(2, caseAudit2, relatedContacts);
});
