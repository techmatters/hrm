const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const {
  contact1,
  contact2,
  broken1,
  broken2,
  another1,
  another2,
  noHelpline,
  case1,
  case2,
} = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const { Contact, Case, CaseAudit } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', 'fake-worker-987'],
    },
  },
};

beforeAll(async () => {
  await Contact.destroy(caseAuditsQuery);
});

afterAll(async done => {
  server.close(done);
});

afterEach(async () => CaseAudit.destroy(caseAuditsQuery));

describe('/contacts route', () => {
  const route = '/contacts';

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
      });
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
          expect(response.body).toHaveLength(2);
          const { contacts, count } = response.body;
          const [c2, c1] = contacts; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
          expect(count).toBe(2);
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
            .send({ firstName: 'ma', lastName: 'ur', helpline: 'Helpline 1' }); // should match another1 & noHelpline

          const { contacts: contacts1, count: count1 } = response1.body;
          const { contacts: contacts2, count: count2 } = response2.body;

          expect(response1.status).toBe(200);
          expect(count1).toBe(3);
          const [nh, a2, a1] = contacts1; // result is sorted DESC
          expect(a1.details).toStrictEqual(another1.form);
          expect(a2.details).toStrictEqual(another2.form);
          expect(nh.details).toStrictEqual(noHelpline.form);

          expect(response2.status).toBe(200);
          expect(count2).toBe(2);
          const [nh2, a] = contacts2; // result is sorted DESC
          expect(a.details).toStrictEqual(another1.form);
          expect(nh2.details).toStrictEqual(noHelpline.form);
        });
      });

      describe('multiple input search without name search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ counselor: 'fake-worker-123' }); // should match contact1 & broken1 & another1 & noHelpline

          const { contacts, count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(4);
          const [nh, a1, b1, c1] = contacts; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(b1.details).toStrictEqual(broken1.form);
          expect(a1.details).toStrictEqual(another1.form);
          expect(nh.details).toStrictEqual(noHelpline.form);
        });
      });

      describe('single input search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ singleInput: 'qwerty' }); // should match contact1 & contact2

          const { contacts, count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(2);
          const [c2, c1] = contacts; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
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

      describe('search over phone regexp (single input)', () => {
        test('should return 200', async () => {
          const { childInformation, callerInformation } = another2.form;
          const phoneNumbers = [
            another2.number,
            childInformation.location.phone1,
            childInformation.location.phone2,
            callerInformation.location.phone1,
            callerInformation.location.phone2,
          ];
          const requests = phoneNumbers.map(phone => {
            const phoneNumber = phone.substr(3, 8);
            return request
              .post(subRoute)
              .set(headers)
              .send({ singleInput: phoneNumber });
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

      describe('search over phone regexp (phoneNumber AND singleInput provided)', () => {
        test('should return 200 (with contacts that matches singleInput)', async () => {
          const phoneNumber = another1.number;
          const singleInput = another2.number;
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ phoneNumber, singleInput });

          const { contacts, count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(1);
          expect(contacts[0].details).toStrictEqual(another2.form);
        });

        test('returns zero contacts (no match for singleInput and phoneNumber is ignored)', async () => {
          const phoneNumber = another1.number;
          const singleInput = '11235813';
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ phoneNumber, singleInput });

          const { count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(0);
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

    beforeEach(async () => {
      createdContact = await Contact.create(contact1);
      createdCase = await Case.create(case1);
      anotherCreatedCase = await Case.create(case2);
      const contactToBeDeleted = await Contact.create(contact1);
      const caseToBeDeleted = await Case.create(case1);

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
      });

      test('should create create a CaseAudit', async () => {
        const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);
        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
        const byGreaterId = (a, b) => b.id - a.id;
        const lastCaseAudit = caseAudits.sort(byGreaterId)[0];
        const { previousValue, newValue } = lastCaseAudit;

        expect(response.status).toBe(200);
        expect(caseAudits).toHaveLength(caseAuditPreviousCount + 1);
        expect(previousValue.contacts).not.toContain(existingContactId);
        expect(newValue.contacts).toContain(existingContactId);
      });

      test('should create create two CaseAudit', async () => {
        await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        const caseAuditPreviousCount = await CaseAudit.count(caseAuditsQuery);

        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: anotherExistingCaseId });

        const caseAudits = await CaseAudit.findAll(caseAuditsQuery);
        const byGreaterId = (a, b) => b.id - a.id;
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
