const supertest = require('supertest');
const app = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const { case1, case2 } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const { Case } = models;

describe('/cases route', () => {
  const route = '/cases';

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 200', async () => {
      const response = await request.get(route).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual([]);
    });
  });

  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(case1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(case1);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(case1.status);
      expect(response.body.helpline).toBe(case1.helpline);
      expect(response.body.info).toStrictEqual(case1.info);
    });
  });

  describe('/cases/:id route', () => {
    describe('PUT', () => {
      let createdCase;
      let nonExistingCaseId;
      let subRoute;

      beforeEach(async () => {
        createdCase = await Case.create(case1);
        subRoute = id => `/cases/${id}`;

        const caseToBeDeleted = await Case.create(case2);
        nonExistingCaseId = caseToBeDeleted.id;
        caseToBeDeleted.destroy();
      });

      afterEach(async () => {
        await createdCase.destroy();
      });

      test('should return 401', async () => {
        const response = await request.put(subRoute(createdCase.id)).send(case1);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });
      test('should return 200', async () => {
        const status = 'closed';
        const response = await request
          .put(subRoute(createdCase.id))
          .set(headers)
          .send({ status });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(status);
      });
      test('should return 404', async () => {
        const status = 'closed';
        const response = await request
          .put(subRoute(nonExistingCaseId))
          .set(headers)
          .send({ status });

        expect(response.status).toBe(404);
      });
    });
  });
});
