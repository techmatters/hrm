import { exportTranscript } from '../../exportTranscript';

const messageList = [
  {
    sid: 1,
    dateCreated: 'blah',
    from: 'counselor',
    body: 'What is your name?',
    index: 0,
    type: 'message',
    media: null,
  },
  {
    sid: 2,
    dateCreated: 'blah',
    from: 'child',
    body: 'George',
    index: 1,
    type: 'message',
    media: null,
  },
];

jest.mock('@tech-matters/hrm-twilio-client', () => {
  const mockClient = {
    chat: {
      v2: {
        services: () => ({
          channels: {
            get: () => ({
              messages: {
                list: () => messageList,
              },
            }),
          },
        }),
      },
    },
  };
  return {
    getClient: jest.fn(() => mockClient),
  };
});

describe('exportTranscript', () => {
  it('transcript should successfully be exported from twilio', async () => {
    const transcript = await exportTranscript({
      accountSid: 'accountSid',
      authToken: 'authToken',
      serviceSid: 'serviceSid',
      channelSid: 'channelSid',
    });

    expect(transcript).toEqual(messageList);
  });
});
