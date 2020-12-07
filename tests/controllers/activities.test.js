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
      icon: 'note',
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
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
        },
      },
    ];

    const activity = getActivity(caseAudit, relatedContacts);
    const expectedActivity = {
      date: createdAt,
      type: 'facebook',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      icon: 'facebook',
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
      date: createdAt,
      type: 'default',
      text: 'Child summary',
      twilioWorkerId: 'twilio-worker-id',
      icon: 'facebook',
    };

    expect(activity).toStrictEqual(expectedActivity);
  });
});
