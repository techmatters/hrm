import { createService } from '../src/app';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
import * as mocks from './mocks';
import { Op } from 'sequelize';
const supertest = require('supertest');
const Sequelize = require('sequelize');
const models = require('../src/models');

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
}).listen();
const request = supertest.agent(server);

const { accountSid, workerSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

const { PostSurvey } = models;

const postSurveys2DestroyQuery = {
  where: {
    accountSid: {
      [Sequelize.Op.and]: [accountSid],
    },
  },
};

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
  await PostSurvey.destroy(postSurveys2DestroyQuery);
});

afterAll(async () =>
  Promise.all([
    proxiedEndpoints.stop(),
    PostSurvey.destroy(postSurveys2DestroyQuery),
    server.close(),
  ]),
);
// afterEach(async () => PostSurvey.destroy(postSurveys2DestroyQuery));

describe('/postSurveys route', () => {
  const route = `/v0/accounts/${accountSid}/postSurveys`;

  describe('/postSurveys/contactTaskId/:id route', () => {

    const body = {
      helpline: 'helpline',
      contactTaskId: 'WTaaaaaaaaaa',
      taskId: 'WTbbbbbbbbbb',
      data: { question: 'Some Answer' },
    };

    const subRoute = `${route}/contactTaskId`;
    const shouldExist = `${subRoute}/${body.contactTaskId}`;
    const shouldNotExist = `${subRoute}/one-that-not-exists`;

    beforeAll(async() => {
      await PostSurvey.create({ ...body, accountSid });
    })

    describe('GET', () => {
      test('should return 401', async () => {
        const response = await request.get(shouldExist);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 200 (no matches)', async () => {
        const response = await request.get(shouldNotExist).set(headers);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(0);
      });

      test('should return 200 (at least one match)', async () => {
        const response = await request.get(shouldExist).set(headers);

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveLength(0);
      });
    });
  });

  // First test post so database wont be empty
  describe('POST', () => {
    const helpline = 'helpline';
    const contactTaskId = 'WTxxxxxxxxxx';
    const taskId = 'WTyyyyyyyyyy';
    const data = { other_question: 'Some Other Answer' };

    const body = { helpline, contactTaskId, taskId, data };

    test('should return 401', async () => {
      const response = await request.post(route).send(body);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(body.data);

      const matchingRowsCount = await PostSurvey.count({
        where: {
          [Op.and]: [accountSid && { accountSid }, contactTaskId && { contactTaskId }, taskId && { taskId }],
        },
      });

      expect(matchingRowsCount).toBe(1)
    });
  });
});
