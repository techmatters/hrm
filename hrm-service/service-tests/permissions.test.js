const supertest = require('supertest');
const each = require('jest-each').default;
const expressApp = require('../src/app');
import { rulesMap } from '../src/permissions';

const server = expressApp.listen();
const request = supertest.agent(server);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

afterAll(done => {
  server.close(() => {
    done();
  });
});

describe('/permissions route', () => {
  describe('GET', () => {
    each([
      {
        headersConfig: {},
        accountSid: 'notConfigured',
        description: 'Should return status 401 (Authorization failed)',
        expectedStatus: 401,
        expectedPayload: 'Authorization failed',
      },
      {
        accountSid: 'notConfigured',
        description: 'Should return status 500 (permissions env var set to empty value)',
        expectedStatus: 500,
        expectedPayload: 'No permissions set for account notConfigured.',
      },
      {
        accountSid: 'missingInEnvVars',
        description: 'Should return status 500 (permissions env var missing)',
        expectedStatus: 500,
        expectedPayload: 'No permissions set for account missingInEnvVars.',
      },
      {
        accountSid: 'notExistsInRulesMap',
        description:
          'Should return status 500 (permissions env var is set but no match found in rulesMap)',
        expectedStatus: 500,
        expectedPayload: 'Permissions rules with name notExistsInRulesMap missing in rules map.',
      },
      ...Object.entries(rulesMap).map(([key, rules]) => ({
        accountSid: key,
        description: `Should return status 200 with ${key} permissions`,
        expectedStatus: 200,
        expectedPayload: rules,
      })),
    ]).test(
      '$description',
      async ({ accountSid, headersConfig = headers, expectedStatus, expectedPayload }) => {
        const response = await request
          .get(`/v0/accounts/${accountSid}/permissions`) // env vars for fake accountsSids set in setTestEnvVars.js
          .set(headersConfig);

        expect(response.status).toBe(expectedStatus);
        if (expectedStatus === 200) expect(response.body).toMatchObject(expectedPayload);
        else expect(response.body.error).toContain(expectedPayload);
      },
    );
  });
});
