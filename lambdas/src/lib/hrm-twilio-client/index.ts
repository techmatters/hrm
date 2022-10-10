import { Twilio } from 'twilio';

export let client: Twilio | ReturnType<typeof getMockClient>;

export const getClient = ({ accountSid, authToken }: { accountSid: string; authToken: string }) => {
  if (!client) {
    client = getClientOrMock({ accountSid, authToken });
  }

  return client;
};

const getClientOrMock = ({ accountSid, authToken }: { accountSid: string; authToken: string }) => {
  /**
   * Discussion:
   * I'd appreciate any suggestions on how to improve this pattern. The root problem is that
   * we want to be able to run local e2e mocks of the Twilio client but we don't have very
   * great control of the code running inside of the lambda from our test runner. (rbd - 10/10/2020)
   */
  if (authToken == 'mockAuthToken') {
    return getMockClient();
  }

  return new Twilio(accountSid, authToken);
};

//TODO: improve this dirty hack that I used to test localstack where twilio doesn't work.
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
