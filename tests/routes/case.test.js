const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../app');
const models = require('../../models');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const { case1, case2, contact1, accountSid } = mocks;
const workerSid = 'worker-sid';
const options = { context: { workerSid } };

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const { Case, CaseAudit, Contact } = models;

const caseAuditsQuery = {
  where: {
    twilioWorkerId: {
      [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', workerSid],
    },
  },
};

afterAll(done => {
  server.close(() => {
    done();
  });
});

beforeAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
});

afterAll(async () => {
  await CaseAudit.destroy(caseAuditsQuery);
});

afterEach(async () => CaseAudit.destroy(caseAuditsQuery));

describe('/cases route', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    test('should return 200', async () => {
      const response = await request.get(route).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({ cases: [], count: 0 });
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
        createdCase = await Case.create(case1, options);
        subRoute = id => `${route}/${id}`;

        const caseToBeDeleted = await Case.create(case2, options);
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

    describe('DELETE', () => {
      let createdCase;
      let nonExistingCaseId;
      let subRoute;

      beforeEach(async () => {
        createdCase = await Case.create(case1, options);
        subRoute = id => `${route}/${id}`;

        const caseToBeDeleted = await Case.create(case2, options);
        nonExistingCaseId = caseToBeDeleted.id;
        await caseToBeDeleted.destroy();
      });

      afterEach(async () => createdCase.destroy());

      test('should return 401', async () => {
        const response = await request.delete(subRoute(createdCase.id)).send();

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });
      test('should return 200', async () => {
        const response = await request
          .delete(subRoute(createdCase.id))
          .set(headers)
          .send();

        expect(response.status).toBe(200);
      });
      test('should return 404', async () => {
        const response = await request
          .delete(subRoute(nonExistingCaseId))
          .set(headers)
          .send();

        expect(response.status).toBe(404);
      });
    });
  });

  const withHouseholds = caseObject => ({
    ...caseObject,
    info: {
      ...caseObject.info,
      households: [
        {
          household: {
            firstName: 'Maria',
            lastName: 'Silva',
            phone1: '+1-202-555-0184',
          },
        },
        {
          household: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ],
    },
  });

  const withPerpetrators = caseObject => ({
    ...caseObject,
    info: {
      ...caseObject.info,
      perpetrators: [
        {
          perpetrator: {
            firstName: 'Maria',
            lastName: 'Silva',
          },
        },
        {
          perpetrator: {
            firstName: 'John',
            lastName: 'Doe',
            phone2: '+12025550184',
          },
        },
      ],
    },
  });

  const fillNameAndPhone = contact => {
    const modifiedContact = {
      ...contact,
      form: {
        ...contact.form,
        childInformation: {
          ...contact.form.childInformation,
          name: {
            firstName: 'Maria',
            lastName: 'Silva',
          },
        },
      },
      number: '+1-202-555-0184',
    };

    modifiedContact.rawJson = modifiedContact.form;
    delete modifiedContact.form;

    return modifiedContact;
  };

  describe('/cases/search route', () => {
    describe('POST', () => {
      let createdCase1;
      let createdCase2;
      let createdCase3;
      let createdContact;
      const subRoute = `${route}/search`;

      beforeEach(async () => {
        createdCase1 = await Case.create(withHouseholds(case1), options);
        createdCase2 = await Case.create(case1, options);
        createdCase3 = await Case.create(withPerpetrators(case1), options);
        createdContact = await Contact.create(fillNameAndPhone(contact1), options);

        // Connects createdContact with createdCase2
        createdContact.caseId = createdCase2.id;
        await createdContact.save(options);
      });

      afterEach(async () => {
        await createdContact.destroy();
        await createdCase1.destroy();
        await createdCase2.destroy();
        await createdCase3.destroy();
      });

      test('should return 401', async () => {
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 200 - search by name', async () => {
        const body = {
          helpline: 'helpline',
          firstName: 'maria',
          lastName: 'silva',
        };
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .set(headers)
          .send(body);

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(3);
        const ids = response.body.cases.map(c => c.id);
        expect(ids).toContain(createdCase1.id);
        expect(ids).toContain(createdCase2.id);
        expect(ids).toContain(createdCase3.id);
      });

      test('should return 200 - search by phone number', async () => {
        const body = {
          helpline: 'helpline',
          phoneNumber: '2025550184',
        };
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .set(headers)
          .send(body);

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(3);
        const ids = response.body.cases.map(c => c.id);
        expect(ids).toContain(createdCase1.id);
        expect(ids).toContain(createdCase2.id);
        expect(ids).toContain(createdCase3.id);
      });

      test('should return 200 - search by date', async () => {
        const body = {
          helpline: 'helpline',
          dateFrom: createdCase1.createdAt,
          dateTo: createdCase3.createdAt,
        };
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .set(headers)
          .send(body);

        expect(response.status).toBe(200);
        expect(response.body.count).toBeGreaterThan(3);
        const ids = response.body.cases.map(c => c.id);
        expect(ids).toContain(createdCase1.id);
        expect(ids).toContain(createdCase2.id);
        expect(ids).toContain(createdCase3.id);
      });

      test('should return 200 - search by contact number', async () => {
        const body = {
          helpline: 'helpline',
          contactNumber: '+1-202-555-0184',
        };
        const response = await request
          .post(subRoute)
          .query({ limit: 20, offset: 0 })
          .set(headers)
          .send(body);

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(1);
        const caseFromDB = response.body.cases[0];
        expect(caseFromDB.id).toStrictEqual(createdCase2.id);
      });
    });
  });
});
