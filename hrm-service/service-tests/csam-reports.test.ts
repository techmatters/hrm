import supertest from 'supertest';
import { createService } from '../src/app';
import * as mocks from './mocks';
import './case-validation';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
import { db } from '../src/connection-pool';
import * as csamReportsApi from '../src/csam-report/csam-report';

console.log(process.env.INCLUDE_ERROR_IN_RESPONSE);

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
}).listen();
const request = supertest.agent(server);

const { accountSid, workerSid } = mocks;

const csamReport1 = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: workerSid,
  contactId: null,
};
const csamReport2 = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: null,
};
const csamReport3 = {
  csamReportId: null,
  twilioWorkerId: workerSid,
};

const { contact1 } = mocks;
const invalidContactCsamReport = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: workerSid,
  contactId: 1234,
};

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

const whereTwilioWorkerIdClause = `WHERE "accountSid" = '${accountSid}' AND ("twilioWorkerId" = '${workerSid}' OR "twilioWorkerId" IS NULL)`;

const cleanupContacts = async () =>
  db.task(t => t.none(`DELETE FROM "Contacts" ${whereTwilioWorkerIdClause}`));

const cleanupCsamReports = async () =>
  db.task(t => t.none(`DELETE FROM "CSAMReports" ${whereTwilioWorkerIdClause}`));

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCsamReports();
  await cleanupContacts();
});

afterAll(async () => {
  await cleanupCsamReports();
  await cleanupContacts();
  await proxiedEndpoints.stop();
  await server.close();
  console.log('csam reports test cleaned up.');
});

describe('/csamReports route', () => {
  const route = `/v0/accounts/${accountSid}/csamReports`;
  const expected = {
    id: expect.anything(),
    accountSid: accountSid,
    csamReportId: 'csam-report-id',
    twilioWorkerId: workerSid,
    contactId: null,
    updatedAt: expect.toParseAsDate(),
    createdAt: expect.toParseAsDate(),
  };

  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(csamReport1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport1);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual(expected);

      const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);

      if (!reportFromDB) {
        throw new Error('reportFromDB is undefined');
      }

      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });

    test('valid contactId, should return 200 and update the database correctly', async () => {
      //Create a Contact for the contactId
      const contactRoute = `/v0/accounts/${accountSid}/contacts`;
      const contactResponse = await request
        .post(contactRoute)
        .set(headers)
        .send(contact1);
      let csamReportWithContactId = { ...csamReport1, contactId: contactResponse.body.id };

      const response = await request
        .post(route)
        .set(headers)
        .send(csamReportWithContactId);

      expect(response.status).toBe(200);
      expect(response.body.contactId).toBe(csamReportWithContactId.contactId);

      const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);

      if (!reportFromDB) {
        throw new Error('reportFromDB is undefined');
      }

      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });

    test('invalid contactId, returns 500', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(invalidContactCsamReport);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain(
        'insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"',
      );
    });

    test('invalid accountSid, returns 500', async () => {
      //Create a Contact for the contactId
      const contactRoute = `/v0/accounts/${accountSid}/contacts`;
      const contactResponse = await request
        .post(contactRoute)
        .set(headers)
        .send(contact1);
      let csamReportWithContactId = { ...csamReport1, contactId: contactResponse.body.id };

      const response = await request
        .post(route.replace(accountSid, 'another-account-sid'))
        .set(headers)
        .send(csamReportWithContactId);

      expect(response.status).toBe(500);
      expect(response.body.message).toContain(
        'insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"',
      );
    });

    test('missing twilioWorkerId, returns 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport2);
      expect(response.status).toBe(200);
      expect(response.body.twilioWorkerId).toEqual('');

      const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);

      if (!reportFromDB) {
        throw new Error('reportFromDB is undefined');
      }

      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });

    test('missing csamReportId, returns 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport3);
      expect(response.status).toBe(200);

      expect(response.body.csamReportId).toEqual('');
      const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB).toBeDefined();
    });
  });
});
