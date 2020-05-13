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
    test('should create a CaseAudit', async () => {
      const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);
      const response = await request
        .post(route)
        .set(headers)
        .send(case1);

      const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
      const byGreaterId = (a, b) => b.id - a.id;
      const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
      const { previousValue, newValue } = lastCaseAudit;

      expect(response.status).toBe(200);
      expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
      expect(previousValue).toBeNull();
      expect(newValue.info).toStrictEqual(case1.info);
      expect(newValue.helpline).toStrictEqual(case1.helpline);
      expect(newValue.status).toStrictEqual(case1.status);
      expect(newValue.twilioWorkerId).toStrictEqual(case1.twilioWorkerId);
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
        await caseToBeDeleted.destroy();
      });

      afterEach(async () => createdCase.destroy());

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
      test('should create a CaseAudit', async () => {
        const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);
        const status = 'closed';
        const response = await request
          .put(subRoute(createdCase.id))
          .set(headers)
          .send({ status });

        const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
        const byGreaterId = (a, b) => b.id - a.id;
        const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
        const { previousValue, newValue } = lastCaseAudit;

        expect(response.status).toBe(200);
        expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);

        expect(previousValue.info).toStrictEqual(case1.info);
        expect(previousValue.helpline).toStrictEqual(case1.helpline);
        expect(previousValue.status).toStrictEqual(case1.status);
        expect(previousValue.twilioWorkerId).toStrictEqual(case1.twilioWorkerId);

        expect(newValue.info).toStrictEqual(case1.info);
        expect(newValue.helpline).toStrictEqual(case1.helpline);
        expect(newValue.status).toStrictEqual(status);
        expect(newValue.twilioWorkerId).toStrictEqual(case1.twilioWorkerId);
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
