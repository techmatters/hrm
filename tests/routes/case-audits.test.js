const supertest = require('supertest');
const Sequelize = require('sequelize');
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

const { Case, CaseAudit } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129'],
    },
  },
};

beforeAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
});

afterAll(done => {
  server.close(done);
});

afterEach(async () => CaseAudit.destroy(caseAuditsQuery));

describe('/cases/:caseId/activities route', () => {
  describe('GET', () => {
    let createdCase;
    let nonExistingCaseId;
    const route = id => `/cases/${id}/activities`;

    beforeEach(async () => {
      createdCase = await Case.create(case1);
      const caseToBeDeleted = await Case.create(case2);
      nonExistingCaseId = caseToBeDeleted.id;
      await caseToBeDeleted.destroy();
    });

    test('should return 401', async () => {
      const response = await request.get(route(createdCase.id));

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 404', async () => {
      const response = await request.get(route(nonExistingCaseId)).set(headers);
      expect(response.status).toBe(404);
    });
    test('should return 200', async () => {
      const response = await request.get(route(createdCase.id)).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual([]);
    });
  });
});
