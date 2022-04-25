const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../src/app');
const models = require('../src/models');
const mocks = require('./mocks');
import './case-validation';

/**
 * This interacts with the DB
 */
const { CSAMReport, Contact } = models;
const CSAMReportController = require('../src/controllers/csam-report-controller')(CSAMReport);

const server = app.listen();
const request = supertest.agent(server);

const { accountSid } = mocks;
const workerSid = 'worker-sid';

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
  twilioWorkerId: 'worker-sid',
  contactId: 1234,
};

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const csamReports2DestroyQuery = {
  where: {
    accountSid: {
      [Sequelize.Op.and]: [accountSid],
    },
  },
};

const query = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: [workerSid],
    },
  },
};

beforeAll(async () => {
  await CSAMReport.destroy(csamReports2DestroyQuery);
  await Contact.destroy(query);
});

afterAll(done => {
  server.close(() => {
    CSAMReport.destroy(csamReports2DestroyQuery).then(() => {
      Contact.destroy(query).then(() => {
        done();
      });
    });
  });
  console.log('csam reports test cleaned up.');
});

describe('/csamReports route', () => {
  const route = `/v0/accounts/${accountSid}/csamReports`;
  const expected = {
    id: expect.anything(),
    accountSid: accountSid,
    csamReportId: 'csam-report-id',
    twilioWorkerId: 'worker-sid',
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

      const reportFromDB = await CSAMReportController.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB).toBeDefined();
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

      const reportFromDB = await CSAMReportController.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });
    test('invalid contactId, returns 500', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(invalidContactCsamReport);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({});
    });
    test('missing twilioWorkerId, returns 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport2);
      expect(response.status).toBe(200);
      expect(response.body.twilioWorkerId).toEqual('');

      const reportFromDB = await CSAMReportController.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });
    test('missing csamReportId, returns 200', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport3);
      expect(response.status).toBe(200);

      expect(response.body.csamReportId).toEqual('');
      const reportFromDB = await CSAMReportController.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB).toBeDefined();
    });
  });
});
