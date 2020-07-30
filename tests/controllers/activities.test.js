const { getActivity } = require('../../controllers/activities');

describe('getActivity', () => {
  test('note added', () => {
    const createdAt = '2020-30-07 18:55:20';
    const caseAudit = {
      createdAt,
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
    };

    expect(activity).toStrictEqual(expectedActivity);
  });

  test('facebook contact connected', () => {
    const createdAt = '2020-30-07 18:55:20';
    const caseAudit = {
      createdAt,
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
    };

    expect(activity).toStrictEqual(expectedActivity);
  });
});
