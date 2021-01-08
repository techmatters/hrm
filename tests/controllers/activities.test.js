const { getActivity } = require('../../controllers/activities');

describe('getActivity', () => {
  test('note added', () => {
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

    const activity = getActivity(caseAudit, []);
    const expectedActivity = {
      date: createdAt,
      type: 'note',
      text: 'content',
      twilioWorkerId: 'twilio-worker-id',
    };

    expect(activity).toStrictEqual(expectedActivity);
  });

  test('referral added', () => {
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

    const activity = getActivity(caseAudit, []);
    const expectedActivity = {
      date: referral.date,
      added: createdAt,
      type: 'referral',
      text: referral.referredTo,
      referral,
      twilioWorkerId: 'twilio-worker-id',
    };

    expect(activity).toStrictEqual(expectedActivity);
  });

  test('facebook contact connected', () => {
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

    const activity = getActivity(caseAudit, relatedContacts);
    const expectedActivity = {
      contactId: 1,
      date: createdAt,
      type: 'facebook',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      channel: 'facebook',
    };

    expect(activity).toStrictEqual(expectedActivity);
  });

  test('default channel - facebook channel (contactless task)', () => {
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

    const activity = getActivity(caseAudit, relatedContacts);
    const expectedActivity = {
      contactId: 1,
      date: '2021-01-07 10:00:00',
      type: 'default',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      channel: 'facebook',
    };

    expect(activity).toStrictEqual(expectedActivity);
  });
});
