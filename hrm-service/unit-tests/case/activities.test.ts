import { getCaseActivities } from '../../src/case/activities';
import { getById } from '../../src/case/case-data-access';

jest.mock('../../src/case/case-data-access');

const CREATED_AT_DATE = '2020-30-07 18:55:20';

const mockFakeCase = (info, connectedContacts = undefined) =>
  (getById as jest.Mock).mockReturnValue({
    accountSid: 'FAKEY_FAKEY',
    createdAt: CREATED_AT_DATE,
    twilioWorkerId: 'twilio-worker-id',
    createdBy: 'twilio-worker-id',
    status: 'open',
    info,
    connectedContacts,
  });

describe('getCaseActivities', () => {
  beforeEach(() => {
    (getById as jest.Mock).mockReturnValue({ info: {} });
  });

  test('Always retrieves case by id & account', async () => {
    const activities = await getCaseActivities(1337, 'FAKEY_FAKEY');
    expect(getById).toHaveBeenCalledWith(1337, 'FAKEY_FAKEY');
    expect(activities).toHaveLength(0);
  });

  test('single note added', async () => {
    const createdAt = '2020-30-07 18:55:20';

    mockFakeCase({
      counsellorNotes: [
        {
          twilioWorkerId: 'note-twilio-worker-id',
          createdAt,
          note: 'content',
        },
      ],
    });

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      date: createdAt,
      type: 'note',
      text: 'content',
      twilioWorkerId: 'note-twilio-worker-id',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single referral added', async () => {
    const createdAt = '2020-30-07 18:55:20';
    const referral = {
      date: '2020-12-15',
      referredTo: 'State Agency 1',
      comments: 'comment',
      createdAt,
      twilioWorkerId: 'referral-adder',
    };
    mockFakeCase({
      referrals: [referral],
    });

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      date: referral.date,
      createdAt,
      type: 'referral',
      text: referral.referredTo,
      referral,
      twilioWorkerId: 'referral-adder',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single facebook contact connected', async () => {
    const timeOfContact = '2020-29-07 18:55:20';
    const createdAt = '2020-30-07 18:55:20';

    mockFakeCase({}, [
      {
        id: 1,
        channel: 'facebook',
        timeOfContact,
        createdAt,
        twilioWorkerId: 'contact-adder',
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
        },
      },
    ]);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      contactId: 1,
      date: timeOfContact,
      createdAt,
      type: 'facebook',
      text: 'Child summary',
      twilioWorkerId: 'contact-adder',
      channel: 'facebook',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('single facebook contact (contactless task)', async () => {
    const timeOfContact = '2021-01-07 10:00:00';
    const createdAt = '2020-30-07 18:55:20';

    mockFakeCase({}, [
      {
        id: 1,
        channel: 'default',
        timeOfContact,
        createdAt,
        twilioWorkerId: 'contact-adder',
        rawJson: {
          caseInformation: {
            callSummary: 'Child summary',
          },
          contactlessTask: {
            channel: 'facebook',
          },
        },
      },
    ]);

    const activities = await getCaseActivities(0, '');
    const expectedActivity = {
      contactId: 1,
      date: timeOfContact,
      createdAt,
      type: 'default',
      text: 'Child summary',
      twilioWorkerId: 'contact-adder',
      channel: 'facebook',
    };

    expect(activities).toStrictEqual([expectedActivity]);
  });

  test('Multiple events - returned in descending date order', async () => {
    const timeOfContact = '2019-01-07 10:00:00';
    const referralCreatedAt = '2020-07-30 18:55:20';
    const referralDate = '2020-06-15';
    const contactCreatedAt = '2020-07-30 19:55:20';
    const noteCreatedAt = '2020-06-30 18:55:20';
    const referral = {
      date: referralDate,
      referredTo: 'State Agency 1',
      comments: 'comment',
      createdAt: referralCreatedAt,
      twilioWorkerId: 'referral-adder',
    };

    mockFakeCase(
      {
        referrals: [referral],
        counsellorNotes: [
          {
            twilioWorkerId: 'note-adder',
            createdAt: noteCreatedAt,
            note: 'content',
          },
        ],
      },
      [
        {
          id: 1,
          channel: 'facebook',
          timeOfContact,
          createdAt: contactCreatedAt,
          twilioWorkerId: 'contact-adder',
          rawJson: {
            caseInformation: {
              callSummary: 'Child summary',
            },
          },
        },
      ],
    );

    const activities = await getCaseActivities(0, '');

    const expectedActivities = [
      {
        date: noteCreatedAt,
        type: 'note',
        text: 'content',
        twilioWorkerId: 'note-adder',
      },
      {
        date: referral.date,
        createdAt: referralCreatedAt,
        type: 'referral',
        text: referral.referredTo,
        referral,
        twilioWorkerId: 'referral-adder',
      },
      {
        contactId: 1,
        date: timeOfContact,
        createdAt: contactCreatedAt,
        type: 'facebook',
        text: 'Child summary',
        twilioWorkerId: 'contact-adder',
        channel: 'facebook',
      },
    ];

    expect(activities).toStrictEqual(expectedActivities);
  });
});
