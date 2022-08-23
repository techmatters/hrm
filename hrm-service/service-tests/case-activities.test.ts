import { createService } from '../src/app';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
import * as caseApi from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import { db } from '../src/connection-pool';
const supertest = require('supertest');
const mocks = require('./mocks');

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
}).listen();
const request = supertest.agent(server);

const { case1, case2, accountSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};
const workerSid = 'worker-sid';

const cleanupCases = () =>
  db.task(t =>
    t.none(`
    DELETE FROM "Cases" 
    WHERE "twilioWorkerId" IN ('fake-worker-123', 'fake-worker-129', '${workerSid}');
  `),
  );

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCases();
});

afterAll(async () => {
  await cleanupCases();

  await proxiedEndpoints.stop();
  await server.close();
});

describe('/cases/:caseId/activities route', () => {
  describe('GET', () => {
    let createdCase;
    let nonExistingCaseId;
    const route = id => `/v0/accounts/${accountSid}/cases/${id}/activities`;
    // const options = { context: {  } };

    beforeEach(async () => {
      createdCase = await caseApi.createCase(case1, accountSid, workerSid);
      const caseToBeDeleted = await caseApi.createCase(case2, accountSid, workerSid);
      nonExistingCaseId = caseToBeDeleted.id;
      await caseDb.deleteById(caseToBeDeleted.id, accountSid);
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
