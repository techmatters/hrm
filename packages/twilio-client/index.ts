import { Twilio } from 'twilio';

import { getMockClient } from './mockClient';

let client: Twilio | ReturnType<typeof getMockClient>;

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
