import app from '../src/app';
const supertest = require('supertest');
const Sequelize = require('sequelize');
const models = require('../src/models');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const { case1, case2, accountSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};
const workerSid = 'worker-sid';

const { Case, CaseAudit } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', workerSid],
    },
  },
};

beforeAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
  await Case.destroy(caseAuditsQuery);
});

afterAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
  await Case.destroy(caseAuditsQuery);
  server.close();
});

afterEach(async () => CaseAudit.destroy(caseAuditsQuery));

describe('/cases/:caseId/activities route', () => {
  describe('GET', () => {
    let createdCase;
    let nonExistingCaseId;
    const route = id => `/v0/accounts/${accountSid}/cases/${id}/activities`;
    const options = { context: { workerSid } };

    beforeEach(async () => {
      createdCase = await Case.create(case1, options);
      const caseToBeDeleted = await Case.create(case2, options);
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
      const caseNote = case1.info.counsellorNotes[0];
      expect(response.body).toStrictEqual([
        {
          text: caseNote.note,
          twilioWorkerId: caseNote.twilioWorkerId,
          date: caseNote.createdAt,
          type: 'note',
        },
      ]);
    });
    test('should reflect edited notes', async () => {
      const updated = {
        ...case1,
        info: {
          ...case1.info,
          counsellorNotes: [
            {
              ...case1.info.counsellorNotes[0],
              note: 'I changed it',
            },
          ],
        },
      };
      await request
        .put(`/v0/accounts/${accountSid}/cases/${createdCase.id}`)
        .set(headers)
        .send(updated);
      const response = await request.get(route(createdCase.id)).set(headers);
      expect(response.status).toBe(200);
      const caseNote = case1.info.counsellorNotes[0];
      expect(response.body).toStrictEqual([
        {
          text: 'I changed it',
          twilioWorkerId: caseNote.twilioWorkerId,
          date: caseNote.createdAt,
          type: 'note',
        },
      ]);
    });
    test('should reflect edited referrals', async () => {
      const update = {
        ...case1,
        info: {
          ...case1.info,
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'comment',
              createdAt: '2020-10-15 16:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
          ],
        },
      };
      await request
        .put(`/v0/accounts/${accountSid}/cases/${createdCase.id}`)
        .set(headers)
        .send(update);
      update.info.referrals[0].referredTo = 'NGO 1';
      await request
        .put(`/v0/accounts/${accountSid}/cases/${createdCase.id}`)
        .set(headers)
        .send(update);
      const response = await request.get(route(createdCase.id)).set(headers);
      expect(response.status).toBe(200);
      const caseNote = case1.info.counsellorNotes[0];
      const updateReferrals = update.info.referrals;
      expect(response.body).toStrictEqual([
        {
          type: 'note',
          text: caseNote.note,
          twilioWorkerId: caseNote.twilioWorkerId,
          date: caseNote.createdAt,
        },
        {
          type: 'referral',
          text: updateReferrals[1].referredTo,
          twilioWorkerId: updateReferrals[1].twilioWorkerId,
          date: updateReferrals[1].date,
          createdAt: updateReferrals[1].createdAt,
          referral: updateReferrals[1],
        },
        {
          type: 'referral',
          text: 'NGO 1',
          twilioWorkerId: updateReferrals[0].twilioWorkerId,
          date: updateReferrals[0].date,
          createdAt: updateReferrals[0].createdAt,
          referral: updateReferrals[0],
        },
      ]);
    });
  });
});
