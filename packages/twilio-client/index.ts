import { Twilio } from 'twilio';

let client: Twilio | ReturnType<typeof getMockClient>;

// TODO: improve this dirty hack that I used to test localstack where twilio doesn't work.
// (rbd - 08/10/22)
export const getMockClient = () => {
  return {
    chat: {
      v2: {
        services: () => ({
          channels: {
            get: () => ({
              messages: {
                list: () => [
                  {
                    sid: 1,
                    dateCreated: 'blah',
                    from: 'person1',
                    body: 'hi',
                    index: 0,
                    type: 'message',
                    media: 'blah',
                  },
                  {
                    sid: 2,
                    dateCreated: 'blah',
                    from: 'person2',
                    body: 'hi',
                    index: 1,
                    type: 'message',
                    media: 'blah',
                  },
                ],
              },
            }),
          },
        }),
      },
    },
  };
};

const getClientOrMock = ({ accountSid, authToken }: { accountSid: string; authToken: string }) => {
  if (authToken === 'mockAuthToken') {
    return getMockClient();
  }

  return new Twilio(accountSid, authToken);
};

export const getClient = ({ accountSid, authToken }: { accountSid: string; authToken: string }) => {
  if (!client) {
    client = getClientOrMock({ accountSid, authToken });
  }

  return client;
};
