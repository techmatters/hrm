const supertest = require('supertest');
const Sequelize = require('sequelize');
const expressApp = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');
import * as casesDb from '../../db/case';

const server = expressApp.listen();
const request = supertest.agent(server);

const { case1, case2, accountSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};
const workerSid = 'worker-sid';

const { CaseAudit } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', workerSid],
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
    const route = id => `/v0/accounts/${accountSid}/cases/${id}/activities`;

    beforeEach(async () => {
      createdCase = await casesDb.create(case1, accountSid, case1.twilioWorkerId);
      const caseToBeDeleted = await casesDb.create(case2, accountSid, case2.twilioWorkerId);
      nonExistingCaseId = caseToBeDeleted.id;
      await casesDb.deleteById(nonExistingCaseId, accountSid);
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
