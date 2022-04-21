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
const workerSid = 'worker-sid';

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

  const csamReportId = 'csam-report-id';

  const body = {
    csamReportId,
    twilioWorkerId: workerSid,
  };

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
      expect(response.body.csamReportId).toEqual(csamReportId);

      const reportFromDB = await CSAMReportController.getCSAMReport(response.body.id, accountSid);
      expect(reportFromDB).toBeDefined();
      expect(reportFromDB.csamReportId).toEqual(csamReportId);
    });
  });
});
