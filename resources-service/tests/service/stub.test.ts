import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

describe('Test stub endpoint', () => {
  const stubRoute = '/v0/accounts/ACCOUNT_SID/resources/resource';

  test('Should return 401 unauthorized', async () => {
    const response = await request.get(stubRoute);
    console.log(response.status);
    console.log(response.body);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  test('Should return 200', async () => {
    const response = await request.get(stubRoute).set(headers);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ '?column?': 1 });
  });
});
