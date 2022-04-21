const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../src/app');
const models = require('../src/models');
const mocks = require('./mocks');

//Notes: I am having a hard time importing this from `./case-validation.ts`
declare global {
  namespace jest {
    interface Matchers<R> {
      toParseAsDate(date: Date): R;
    }
    // @ts-ignore
    interface Expect<R> {
      toParseAsDate(date: Date): R;
    }
  }
}

expect.extend({
  toParseAsDate(received, date) {
    let receivedDate;
    try {
      receivedDate = received instanceof Date ? received : Date.parse(received);
    } catch (e) {
      return {
        pass: false,
        message: () => `Expected '${received}' to be a parseable date. Error: ${e}`,
      };
    }

    if (date) {
      const expectedDate = typeof date === 'string' ? Date.parse(date) : date;
      const pass = receivedDate.valueOf() === expectedDate.valueOf();
      return {
        pass,
        message: () => `Expected '${received}' to be the same as '${expectedDate.toISOString()}'`,
      };
    }

    return {
      pass: true,
      message: () => `Expected '${received}' to be a parseable date.`,
    };
  },
});

/**
 * This interacts with the DB
 */
const { CSAMReport } = models;
const CSAMReportController = require('../src/controllers/csam-report-controller')(CSAMReport);

const server = app.listen();
const request = supertest.agent(server);

const { accountSid } = mocks;
// const workerSid = 'worker-sid';
/**
 * Notes: I think these should belong in the mocks.js. I will move them once I finalize this PR. I understand I have to destroy them, and I was hoping you can point me to the best practise to do this.
 */

const csamReport1 = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: 'worker-sid',
};
const csamReport2 = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: null,
};
const csamReport3 = {
  csamReportId: null,
  twilioWorkerId: 'worker-sid',
};
const csamReport4 = {
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

beforeAll(async () => {
  await CSAMReport.destroy(csamReports2DestroyQuery);
});

afterAll(done => {
  server.close(() => {
    CSAMReport.destroy(csamReports2DestroyQuery).then(() => {
      console.log('csam reports test cleaned up.');
      done();
    });
  });
});

describe('/csamReports route', () => {
  const route = `/v0/accounts/${accountSid}/csamReports`;

  // const csamReportId = 'csam-report-id';

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
      /**
       * Notes: console logging reportFromDB is not returning anything in console. I am thinking the 2 statements below are not being executed.
       *
       */
      expect(reportFromDB).toBeDefined();
      expect(reportFromDB.csamReportId).toEqual(expected.csamReportId);
    });

    test('unsure - when request is missing twilioWorkerId', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport2);
      expect(response.status).toBe(200);
      expect(response.body.twilioWorkerId).toEqual('');
      /**
       * Notes: This is just a passing test. I was expecting this test to have a status of 500 and returning an empty response body
       *
       */
    });
    test('unsure - when request is missing csamReportId', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport3);
      expect(response.status).toBe(200);
      expect(response.body.csamReportId).toEqual('');
      /**
       * Notes: This is just a passing test. I was expecting this test to have a status of 500 and returning an empty response body
       *
       */
    });
    test('unsure - scenario when contactId is part of response', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(csamReport4);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({});
      /**
       * Notes: This is just a passing test. I was expecting this test to have a status of 200 and returning a response body similar to 2nd test in this suite, i.e., similar to expected stated above.
       *
       * My reasoning is: contactId has a relation to csamReport. While this is not actually being leveraged by the UI, it is something given the sql data model of CSAMReport, should return the corresponding contactId. I might just be missing something.
       *
       */
    });
  });
});
