import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';

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
  await db.multi(
    [
      'INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES (\'RESOURCE_1\', \'ACCOUNT_1\', \'Resource 1 (Account 1)\')',
      'INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES (\'RESOURCE_2\', \'ACCOUNT_1\', \'Resource 2 (Account 1)\')',
      'INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES (\'RESOURCE_3\', \'ACCOUNT_1\', \'Resource 3 (Account 1)\')',
      'INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES (\'RESOURCE_1\', \'ACCOUNT_2\', \'Resource 1 (Account 2)\')',
      'INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES (\'RESOURCE_2\', \'ACCOUNT_2\', \'Resource 2 (Account 2)\')',
    ].join(';'),
  );
});

describe('GET /resource', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/resource';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`);
    console.log(response.status);
    console.log(response.body);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  test('Should return a 200 response with a single resource object', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`).set(headers);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: 'RESOURCE_1',
      name: 'Resource 1 (Account 1)',
    });
  });
});
