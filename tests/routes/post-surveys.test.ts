const supertest = require('supertest');
const Sequelize = require('sequelize');
const expressApp = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');

const server = expressApp.listen();
const request = supertest.agent(server);

const { accountSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
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
  await PostSurvey.destroy(postSurveys2DestroyQuery);
});

afterAll(done => {
  server.close(() => {
    console.log('post survey server closed.');
    PostSurvey.destroy(postSurveys2DestroyQuery).then(() => {
      console.log('post survey cleaned up.');
      done();
    });
  });
});

// afterEach(async () => PostSurvey.destroy(postSurveys2DestroyQuery));

describe('/postSurveys route', () => {
  const route = `/v0/accounts/${accountSid}/postSurveys`;

  const body = {
    helpline: 'helpline',
    contactTaskId: 'WTxxxxxxxxxx',
    taskId: 'WTyyyyyyyyyy',
    data: { question: 'Some Answer' },
  };

  // First test post so database wont be empty
  describe('POST', () => {
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
    });
  });

  describe('/postSurveys/contactTaskId/:id route', () => {
    const subRoute = `${route}/contactTaskId`;
    const shouldExist = `${subRoute}/${body.contactTaskId}`;
    const shouldNotExist = `${subRoute}/one-that-not-exists`;

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
});
