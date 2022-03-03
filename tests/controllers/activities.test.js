const ContactControllerModule = require('../../controllers/contact-controller');
const CaseControllerModule = require('../../controllers/case-controller');
const CaseAuditControllerModule = require('../../controllers/case-audit-controller');

jest.mock('../../controllers/case-controller');
jest.mock('../../controllers/contact-controller');
jest.mock('../../controllers/case-audit-controller');

const CaseController = {
  getCase: jest.fn(),
};

const ContactController = {
  getContactsById: jest.fn(),
};

const CaseAuditController = {
  getAuditsForCase: jest.fn(),
};

CaseControllerModule.mockReturnValue(CaseController);
ContactControllerModule.mockReturnValue(ContactController);
CaseAuditControllerModule.mockReturnValue(CaseAuditController);

const mockSingleAudit = caseAudit => {
  CaseAuditController.getAuditsForCase.mockReturnValue([caseAudit]);
};

const mockAudits = caseAudits => {
  CaseAuditController.getAuditsForCase.mockReturnValue(caseAudits);
};

const mockContacts = contacts => {
  ContactController.getContactsById.mockReturnValue(contacts);
};

const { getCaseActivities } = require('../../controllers/activities');

const CREATED_AT_DATE = '2020-30-07 18:55:20';

const generateFakeAudit = newValue => ({
  createdAt: CREATED_AT_DATE,
  twilioWorkerId: 'twilio-worker-id',
  previousValue: {
    contacts: [],
  },
  newValue,
});

const generateFakeContact = id => ({ id, channel: 'sms', rawJson: { caseInformation: {} } });

describe('getCaseActivities', () => {
  beforeEach(() => {
    CaseController.getCase.mockReturnValue({});
    ContactController.getContactsById.mockReturnValue([]);
    CaseAuditController.getAuditsForCase.mockReturnValue([]);
  });

  test('Always retrieves case by id & account', async () => {
    const activities = await getCaseActivities(1337, 'FAKEY_FAKEY');
    expect(CaseController.getCase).toHaveBeenCalledWith(1337, 'FAKEY_FAKEY');
    expect(activities).toHaveLength(0);
  });

  test('Always retrieves case audits by id & account', async () => {
    const activities = await getCaseActivities(1337, 'FAKEY_FAKEY');
    expect(CaseAuditController.getAuditsForCase).toHaveBeenCalledWith(1337, 'FAKEY_FAKEY');
    expect(activities).toHaveLength(0);
  });

  test('Always queries all contacts found in audit data', async () => {
    CaseAuditController.getAuditsForCase.mockReturnValue([
      generateFakeAudit({ contacts: [1, 2, 4] }),
      generateFakeAudit({ contacts: [2, 4, 5] }),
      generateFakeAudit({ contacts: [5, 1, 6] }),
    ]);
    ContactController.getContactsById.mockReturnValue([
      generateFakeContact(1),
      generateFakeContact(2),
      generateFakeContact(4),
      generateFakeContact(5),
      generateFakeContact(6),
    ]);
    const activities = await getCaseActivities(1337, 'FAKEY_FAKEY');
    expect(ContactController.getContactsById).toHaveBeenCalledWith(
      expect.arrayContaining([1, 2, 4, 5, 6]),
      'FAKEY_FAKEY',
    );
    expect(activities).toHaveLength(3);
  });

  test('single note added', async () => {
    const createdAt = '2020-30-07 18:55:20';
    const caseAudit = {
      createdAt,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        info: {
          notes: [],
        },
      },
      newValue: {
        info: {
          notes: ['content'],
        },
      },
    };
    mockSingleAudit(caseAudit);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      date: createdAt,
      type: 'note',
      text: 'content',
      twilioWorkerId: 'twilio-worker-id',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single referral added', async () => {
    const createdAt = '2020-30-07 18:55:20';
    const referral = { date: '2020-12-15', referredTo: 'State Agency 1', comments: 'comment' };
    const caseAudit = {
      createdAt,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        info: {
          referrals: [],
        },
      },
      newValue: {
        info: {
          referrals: [referral],
        },
      },
    };

    mockSingleAudit(caseAudit);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      date: referral.date,
      createdAt,
      type: 'referral',
      text: referral.referredTo,
      referral,
      twilioWorkerId: 'twilio-worker-id',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single facebook contact connected', async () => {
    const createdAt = '2020-30-07 18:55:20';
    const caseAudit = {
      createdAt,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        contacts: [],
      },
      newValue: {
        contacts: [1],
      },
    };
    const relatedContacts = [
      {
        id: 1,
        channel: 'facebook',
        timeOfContact: createdAt,
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
        },
      },
    ];

    mockSingleAudit(caseAudit);
    mockContacts(relatedContacts);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      contactId: 1,
      date: createdAt,
      createdAt,
      type: 'facebook',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      channel: 'facebook',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single facebook contact (contactless task)', async () => {
    const createdAt = '2020-30-07 18:55:20';
    const caseAudit = {
      createdAt,
      twilioWorkerId: 'twilio-worker-id',
      previousValue: {
        contacts: [],
      },
      newValue: {
        contacts: [1],
      },
    };
    const relatedContacts = [
      {
        id: 1,
        channel: 'default',
        timeOfContact: '2021-01-07 10:00:00',
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
          contactlessTask: {
            channel: 'facebook',
          },
        },
      },
    ];
    mockSingleAudit(caseAudit);
    mockContacts(relatedContacts);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      contactId: 1,
      date: '2021-01-07 10:00:00',
      createdAt,
      type: 'default',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      channel: 'facebook',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('Multiple events - returned in order audits were retrieved from DB', async () => {
    const referral = { date: '2020-12-15', referredTo: 'State Agency 1', comments: 'comment' };
    const audits = [
      generateFakeAudit({
        info: {
          notes: ['content'],
        },
      }),
      generateFakeAudit({
        info: {
          referrals: [referral],
        },
      }),
      generateFakeAudit({
        contacts: [1],
      }),
    ];

    const relatedContacts = [
      {
        id: 1,
        channel: 'facebook',
        timeOfContact: CREATED_AT_DATE,
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
        },
      },
    ];

    mockAudits(audits);
    mockContacts(relatedContacts);

    const activities = await getCaseActivities(0, '');

    const expectedActivities = [
      {
        date: CREATED_AT_DATE,
        type: 'note',
        text: 'content',
        twilioWorkerId: 'twilio-worker-id',
      },
      {
        date: referral.date,
        createdAt: CREATED_AT_DATE,
        type: 'referral',
        text: referral.referredTo,
        referral,
        twilioWorkerId: 'twilio-worker-id',
      },
      {
        contactId: 1,
        date: CREATED_AT_DATE,
        createdAt: CREATED_AT_DATE,
        type: 'facebook',
        text: 'Child summary',
        twilioWorkerId: 'twilio-worker-id',
        channel: 'facebook',
      },
    ];

    expect(activities).toStrictEqual(expectedActivities);
  });
});
