import { createService } from '../src/app';
import { rulesMap } from '../src/permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
const { workerSid } = require('./mocks');

const supertest = require('supertest');
const each = require('jest-each').default;

const server = createService({
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
}).listen();
const request = supertest.agent(server);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => Promise.all([server.close(), proxiedEndpoints.stop()]));

describe('/permissions route', () => {
  describe('GET', () => {
    each([
      {
        headersConfig: {},
        accountSid: 'notConfigured',
        description: 'Should return status 401 (Authorization failed)',
        expectedStatus: 401,
      },
      {
        accountSid: 'notConfigured',
        description: 'Should return status 500 (permissions env var set to empty value)',
        expectedStatus: 500,
      },
      {
        accountSid: 'missingInEnvVars',
        description: 'Should return status 500 (permissions env var missing)',
        expectedStatus: 500,
      },
      {
        accountSid: 'notExistsInRulesMap',
        description:
          'Should return status 500 (permissions env var is set but no match found in rulesMap)',
        expectedStatus: 500,
      },
      ...Object.entries(rulesMap).map(([key, rules]) => ({
        accountSid: key,
        description: `Should return status 200 with ${key} permissions`,
        expectedStatus: 200,
        expectedPayload: rules,
      })),
    ]).test(
      '$description',
      async ({
        accountSid,
        headersConfig = headers,
        expectedStatus,
        expectedPayload = undefined,
      }) => {
        const response = await request
          .get(`/v0/accounts/${accountSid}/permissions`) // env vars for fake accountsSids set in setTestEnvVars.js
          .set(headersConfig);

        expect(response.status).toBe(expectedStatus);
        if (expectedStatus === 200) expect(response.body).toMatchObject(expectedPayload);
      },
    );
  });
});
