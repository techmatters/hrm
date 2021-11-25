const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const {
  accountSid,
  contact1,
  contact2,
  broken1,
  broken2,
  another1,
  another2,
  noHelpline,
  withTaskId,
  case1,
  case2,
} = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};
const workerSid = 'worker-sid';

const { Contact, Case, CaseAudit, CSAMReport } = models;
const CSAMReportController = require('../../controllers/csam-report-controller')(CSAMReport);

const query = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', 'fake-worker-987', workerSid],
    },
  },
};

beforeAll(async () => {
  await Contact.destroy(query);
});

afterAll(async done => {
  server.close(done);
  await Case.destroy(query);
  await CSAMReport.destroy(query);
});

afterEach(async () => CaseAudit.destroy(query));

describe('/contacts route', () => {
  const route = `/v0/accounts/${accountSid}/contacts`;

  // First test post so database wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const contacts = [contact1, contact2, broken1, broken2, another1, another2, noHelpline];
      const requests = contacts.map(item =>
        request
          .post(route)
          .set(headers)
          .send(item),
      );
      const responses = await Promise.all(requests);

      responses.forEach((res, index) => {
        expect(res.status).toBe(200);
        expect(res.body.rawJson.callType).toBe(contacts[index].form.callType);
        expect(res.body.rawJson.callType).toBe(contacts[index].form.callType);
      });
    });

    test('Idempotence on create contact', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(withTaskId);

      const beforeContacts = await request.get(route).set(headers);

      const subsequentResponse = await request
        .post(route)
        .set(headers)
        .send(withTaskId);

      const afterContacts = await request.get(route).set(headers);

      // both should succeed
      expect(response.status).toBe(200);
      expect(subsequentResponse.status).toBe(200);

      // but second call should do nothing
      expect(afterContacts.body).toHaveLength(beforeContacts.body.length);
    });

    test('Connects to CSAM reports', async () => {
      // Create CSAM Report
      const csamReportId1 = 'csam-report-id-1';
      const csamReportId2 = 'csam-report-id-2';

      const newReport1 = (
        await CSAMReportController.createCSAMReport(
          {
            csamReportId: csamReportId1,
            twilioWorkerId: workerSid,
          },
          accountSid,
        )
      ).dataValues;

      const newReport2 = (
        await CSAMReportController.createCSAMReport(
          {
            csamReportId: csamReportId2,
            twilioWorkerId: workerSid,
          },
          accountSid,
        )
      ).dataValues;

      // Create contact with above report
      const response = await request
        .post(route)
        .set(headers)
        .send({ ...contact1, csamReports: [newReport1, newReport2] });

      const updatedReport1 = await CSAMReportController.getCSAMReport(newReport1.id, accountSid);
      expect(updatedReport1.contactId).toEqual(response.body.id);
      expect(updatedReport1.csamReportId).toEqual(csamReportId1);

      const updatedReport2 = await CSAMReportController.getCSAMReport(newReport2.id, accountSid);
      expect(updatedReport2.contactId).toEqual(response.body.id);
      expect(updatedReport2.csamReportId).toEqual(csamReportId2);

      // Test the association
      expect(response.body.csamReports).toHaveLength(2);

      // Remove this contact to not interfere with following tests
      await Contact.destroy({ where: { id: response.body.id } });
    });
  });

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request.get(route).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveLength(0);
    });
  });

  describe('/contacts/search route', () => {
    const subRoute = `${route}/search`;

    describe('POST', () => {
      test('should return 401', async () => {
        const response = await request.post(subRoute).send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      describe('multiple input search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'jh', lastName: 'he' }); // should filter non-data

          expect(response.status).toBe(200);
          const { contacts, count } = response.body;
          const [c2, c1] = contacts; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
          expect(count).toBe(2);

          // Test the association
          expect(c1.csamReports).toHaveLength(0);
          expect(c2.csamReports).toHaveLength(0);
        });
      });

      describe('multiple input search that targets zero contacts', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'jh', lastName: 'curie' });

          const { count } = response.body;
          expect(response.status).toBe(200);
          expect(count).toBe(0);
        });
      });

      describe('multiple input search with helpline', () => {
        test('should return 200', async () => {
          const response1 = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'ma', lastName: 'ur' }); // should match another1 & another2

          const response2 = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'ma', lastName: 'ur', helpline: 'Helpline 1' }); // should bring only the case with 'Helpline 1'

          const { contacts: contacts1, count: count1 } = response1.body;
          const { contacts: contacts2, count: count2 } = response2.body;

          expect(response1.status).toBe(200);
          expect(count1).toBe(3);
          const [nh, a2, a1] = contacts1; // result is sorted DESC
          expect(a1.details).toStrictEqual(another1.form);
          expect(a2.details).toStrictEqual(another2.form);
          expect(nh.details).toStrictEqual(noHelpline.form);

          expect(response2.status).toBe(200);
          expect(count2).toBe(1);
          const [a] = contacts2; // result is sorted DESC
          expect(a.details).toStrictEqual(another1.form);
        });
      });

      describe('multiple input search without name search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ counselor: 'worker-sid' }); // should match contact1 & broken1 & another1 & noHelpline

          const { contacts, count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(8); // TODO: This fails locally. Not sure why on CI count is 8 instead of 7.
          const [nh, a2, a1, b2, b1, c2, c1] = contacts; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
          expect(b1.details).toStrictEqual(broken1.form);
          expect(b2.details).toStrictEqual(broken2.form);
          expect(a1.details).toStrictEqual(another1.form);
          expect(a2.details).toStrictEqual(another2.form);
          expect(nh.details).toStrictEqual(noHelpline.form);
        });
      });

      describe('search over phone regexp (multi input)', () => {
        test('should return 200', async () => {
          const phoneNumbers = [
            another2.number,
            another2.form.childInformation.location.phone1,
            another2.form.childInformation.location.phone2,
            another2.form.callerInformation.location.phone1,
            another2.form.callerInformation.location.phone2,
          ];
          const requests = phoneNumbers.map(phone => {
            const phoneNumber = phone.substr(1, 6);
            return request
              .post(subRoute)
              .set(headers)
              .send({ phoneNumber, lastName: 'curi' });
          });

          const responses = await Promise.all(requests);

          responses.forEach(res => {
            const { count, contacts } = res.body;
            expect(res.status).toBe(200);
            expect(count).toBe(1);
            expect(contacts[0].details).toStrictEqual(another2.form);
          });
        });
      });

      describe('search over phone regexp', () => {
        test('should return 200', async () => {
          const phoneNumber = another2.number;
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ phoneNumber });

          const { contacts, count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(1);
          expect(contacts[0].details).toStrictEqual(another2.form);
        });
      });

      // https://github.com/tech-matters/hrm/pull/33#discussion_r409904466
      describe('search FAILS if the number in DB is a substring of the input', () => {
        test('returns zero contacts (adding the country code)', async () => {
          const phoneNumber = `+1 ${another2.form.childInformation.location.phone1}`;
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ phoneNumber });

          const { count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(0);
        });
      });
    });
  });

  describe('/contacts/:contactId/connectToCase route', () => {
    let createdContact;
    let createdCase;
    let anotherCreatedCase;
    let existingContactId;
    let nonExistingContactId;
    let existingCaseId;
    let anotherExistingCaseId;
    let nonExistingCaseId;

    const byGreaterId = (a, b) => b.id - a.id;

    beforeEach(async () => {
      const options = { context: { workerSid } };
      createdContact = await Contact.create(contact1, options);
      createdCase = await Case.create(case1, options);
      anotherCreatedCase = await Case.create(case2, options);
      const contactToBeDeleted = await Contact.create(contact1, options);
      const caseToBeDeleted = await Case.create(case1, options);

      existingContactId = createdContact.id;
      existingCaseId = createdCase.id;
      anotherExistingCaseId = anotherCreatedCase.id;
      nonExistingContactId = contactToBeDeleted.id;
      nonExistingCaseId = caseToBeDeleted.id;

      await contactToBeDeleted.destroy();
      await caseToBeDeleted.destroy();
    });

    afterEach(async () => {
      await createdContact.destroy();
      await createdCase.destroy();
      await anotherCreatedCase.destroy();
    });

    describe('PUT', () => {
      const subRoute = contactId => `${route}/${contactId}/connectToCase`;

      test('should return 401', async () => {
        const response = await request.put(subRoute(existingContactId)).send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 200', async () => {
        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        expect(response.status).toBe(200);
        expect(response.body.caseId).toBe(existingCaseId);

        // Test the association
        expect(response.body.csamReports).toHaveLength(0);
      });

      test('should create a CaseAudit', async () => {
        const caseAuditPreviousCount = await CaseAudit.count(query);
        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const caseAudits = await CaseAudit.findAll(query);
        const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
        const { previousValue, newValue } = lastCaseAudit;

        expect(response.status).toBe(200);
        expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
        expect(previousValue.contacts).not.toContain(existingContactId);
        expect(newValue.contacts).toContain(existingContactId);
      });

      test('Idempotence on connect contact to case', async () => {
        const response1 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const beforeCaseAuditCount = await CaseAudit.count(query);

        // repeat above operation (should do nothing)
        const response2 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const afterCaseAuditCount = await CaseAudit.count(query);

        // both should succeed
        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);

        // but second call should do nothing
        expect(afterCaseAuditCount).toBe(beforeCaseAuditCount);
      });

      test('should create two CaseAudit', async () => {
        await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const caseAuditPreviousCount = await CaseAudit.count(query);

        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: anotherExistingCaseId });

        const caseAudits = await CaseAudit.findAll(query);
        const firstCaseAudit = caseAudits.sort(byGreaterId)[0];
        const secondCaseAudit = caseAudits.sort(byGreaterId)[1];
        const {
          previousValue: previousValueFromFirst,
          newValue: newValueFromFirst,
        } = firstCaseAudit;
        const {
          previousValue: previousValueFromSecond,
          newValue: newValueFromSecond,
        } = secondCaseAudit;

        expect(response.status).toBe(200);
        expect(caseAudits).toHaveLength(caseAuditPreviousCount + 2);
        expect(previousValueFromFirst.contacts).not.toContain(existingContactId);
        expect(newValueFromFirst.contacts).toContain(existingContactId);
        expect(previousValueFromSecond.contacts).toContain(existingContactId);
        expect(newValueFromSecond.contacts).not.toContain(existingContactId);
      });

      describe('use non-existent contactId', () => {
        test('should return 404', async () => {
          const response = await request
            .put(subRoute(nonExistingContactId))
            .set(headers)
            .send({ caseId: existingCaseId });

          expect(response.status).toBe(404);
        });
      });
      describe('use non-existent caseId', () => {
        test('should return 404', async () => {
          const response = await request
            .put(subRoute(existingContactId))
            .set(headers)
            .send({ caseId: nonExistingCaseId });

          expect(response.status).toBe(404);
        });
      });
    });
  });
});
