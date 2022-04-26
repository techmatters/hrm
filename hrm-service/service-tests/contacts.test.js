const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../src/app');
const models = require('../src/models');
const mocks = require('./mocks');
const each = require('jest-each').default;
const { formatNumber } = require('../src/controllers/helpers');
const { db } = require('../src/connection-pool');
import './case-validation';

const server = app.listen();
const request = supertest.agent(server);

/**
 *
 * @param {(() => Promise<any>)[]} ps
 * @returns
 */
const resolveSequentially = ps =>
  ps.reduce((p, v) => p.then(a => v().then(r => a.concat([r]))), Promise.resolve([]));

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

const { Contact, Case, CSAMReport } = models;
const CSAMReportController = require('../src/controllers/csam-report-controller')(CSAMReport);

const query = {
  where: {
    [Sequelize.Op.or]: [
      {
        twilioWorkerId: {
          [Sequelize.Op.in]: ['fake-worker-123', 'fake-worker-129', 'fake-worker-987', workerSid],
        },
      },
      {
        accountSid: {
          [Sequelize.Op.in]: ['', accountSid],
        },
      },
    ],
  },
};

beforeAll(async () => {
  await Contact.destroy(query);
});

afterAll(done => {
  server.close(() => {
    Case.destroy(query).then(() => {
      CSAMReport.destroy(query).then(() => {
        Contact.destroy(query).then(() => done());
      });
    });
  });
  console.log('Deleted data in contacts.test');
});

describe('/contacts route', () => {
  const route = `/v0/accounts/${accountSid}/contacts`;

  // First test post so database wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    each([
      {
        contact: contact1,
        changeDescription: 'callType is Child calling about self',
      },
      {
        contact: contact2,
        changeDescription: 'callType is Someone calling about a child',
      },
      {
        contact: broken1,
        changeDescription:
          'contact is non data with actual information (1) (no payload manipulation)',
      },
      {
        contact: broken2,
        changeDescription:
          'contact is non data with actual information (2) (no payload manipulation)',
      },
      {
        contact: another1,
        changeDescription: 'callType is Child calling about self (with variations in the form)',
      },
      {
        contact: another2,
        changeDescription:
          'callType is Someone calling about a child (with variations in the form)',
      },
      {
        contact: noHelpline,
        changeDescription: 'there is no helpline set in the payload',
      },
      {
        contact: {
          form: {},
          twilioWorkerId: null,
          helpline: null,
          queueName: null,
          number: null,
          channel: null,
          conversationDuration: null,
          accountSid: null,
          timeOfContact: null,
          taskId: null,
          channelSid: null,
          serviceSid: null,
        },
        expectedGetContact: {
          form: {},
          twilioWorkerId: '',
          helpline: '',
          queueName: null,
          number: '',
          channel: '',
          conversationDuration: null,
          accountSid: '',
          taskId: '',
          channelSid: '',
          serviceSid: '',
        },
        changeDescription: 'missing fields (filled with defaults)',
      },
    ]).test(
      'should return 200 when $changeDescription',
      async ({ contact, expectedGetContact = null }) => {
        // const updateSpy = jest.spyOn(CSAMReport, 'update');

        const expected = expectedGetContact || contact;

        const res = await request
          .post(route)
          .set(headers)
          .send(contact);

        expect(res.status).toBe(200);
        expect(res.body.rawJson.callType).toBe(contact.form.callType);
        expect(res.body.rawJson.callType).toBe(contact.form.callType);

        // expect(updateSpy).not.toHaveBeenCalled();

        const contacts = await request.get(route).set(headers);

        const createdContact = contacts.body.find(c => c.id === res.body.id);
        expect(createdContact).toBeDefined();

        expect(createdContact.FormData).toMatchObject(expected.form);
        expect(createdContact.Date).toParseAsDate();
        expect(createdContact.twilioWorkerId).toBe(expected.twilioWorkerId);
        expect(createdContact.helpline).toBe(expected.helpline);
        expect(createdContact.queueName).toBe(
          expected.queueName || expected.form.queueName || null,
        );
        expect(createdContact.number).toBe(formatNumber(expected.number));
        expect(createdContact.channel).toBe(expected.channel);
        expect(createdContact.conversationDuration).toBe(expected.conversationDuration);
      },
    );

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
      expect(afterContacts.body.filter(c => c.id === response.body.id)).toHaveLength(1);
    });

    test('Connects to CSAM reports (not existing csam report id, do nothing)', async () => {
      const updateSpy = jest.spyOn(CSAMReport, 'update');

      const notExistingCsamReport = { id: 99999999 };

      // Create contact with above report
      const response = await request
        .post(route)
        .set(headers)
        .send({ ...contact1, csamReports: [notExistingCsamReport] });

      expect(updateSpy).toHaveBeenCalled();

      // Test the association
      expect(response.status).toBe(200);

      // Test the association
      expect(response.body.csamReports).toHaveLength(0);

      // No new report is created
      await expect(
        CSAMReportController.getCSAMReport(notExistingCsamReport.id, accountSid),
      ).rejects.toThrow(`CSAM Report with id ${notExistingCsamReport.id} not found`);

      await Contact.destroy({ where: { id: response.body.id } });
    });

    test('Connects to CSAM reports (valid csam reports ids)', async () => {
      const updateSpy = jest.spyOn(CSAMReport, 'update');

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

      expect(updateSpy).toHaveBeenCalled();

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

  const mapId = c => c.id;
  const compareTimeOfContactDesc = (c1, c2) =>
    new Date(c2.timeOfContact) - new Date(c1.timeOfContact);

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    const queueName = 'queue-name';

    let createdContacts = [];
    beforeAll(async () => {
      // Clean what's been created so far
      await Contact.destroy(query);

      // Create some contacts to work with
      const contact = { ...contact1 };

      const withQueueName = { ...contact, queueName };

      const oneHourBefore = {
        ...withQueueName,
        timeOfContact: new Date(new Date().getTime() - 1000 * 60 * 60).toISOString(), // one hour before
      };

      const responses = await resolveSequentially(
        [
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          withQueueName,
          oneHourBefore,
          withQueueName,
        ].map(c => () =>
          request
            .post(route)
            .set(headers)
            .send(c),
        ),
      );

      createdContacts = responses.map(r => r.body);
    });

    afterAll(async () => {
      await Contact.destroy({
        where: {
          id: {
            [Sequelize.Op.in]: createdContacts.map(c => c.id),
          },
        },
      });

      createdContacts = [];
    });

    each([
      {
        queryParams: '',
        changeDescription: 'no query params provided',
        expectCallback: response => {
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(10);

          // Get the first 10 contacts (should exclude "oneHourBefore")
          const expectedContactsResponse = createdContacts
            .sort(compareTimeOfContactDesc)
            .slice(0, 10);

          expectedContactsResponse.forEach(c =>
            expect(response.body.find(c2 => c.id === c2.id)).toBeDefined(),
          );
          expect(response.body.map(mapId)).toMatchObject(expectedContactsResponse.map(mapId));
        },
      },
      {
        queryParams: `queueName=${queueName}`,
        changeDescription: 'with query param (filter by queueName)',
        expectCallback: response => {
          expect(response.status).toBe(200);
          expect(response.body.length).toBe(3);

          const withQ = createdContacts.filter(c => c.queueName === queueName);

          withQ.forEach(c => expect(response.body.find(c2 => c.id === c2.id)).toBeDefined());
          expect(response.body.map(mapId)).toMatchObject(
            withQ.sort(compareTimeOfContactDesc).map(mapId),
          );
        },
      },
    ]).test(
      'should return 200 when $changeDescription',
      async ({ expectCallback, queryParams }) => {
        const response = await request.get(`${route}?${queryParams}`).set(headers);
        expectCallback(response);
      },
    );
  });

  describe('/contacts/search route', () => {
    const subRoute = `${route}/search`;

    describe('POST', () => {
      test('should return 401', async () => {
        const response = await request.post(subRoute).send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      let createdContacts = [];
      beforeAll(async () => {
        // Clean what's been created so far
        await Contact.destroy(query);

        // Create some contacts to work with
        const oneHourBefore = {
          ...another2,
          timeOfContact: new Date(new Date().getTime() - 1000 * 60 * 60).toISOString(), // one hour before
        };

        const oneWeekBefore = {
          ...noHelpline,
          timeOfContact: new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(), // one hour before
        };

        const invalidContact = {};

        const responses = await resolveSequentially(
          [
            contact1,
            contact2,
            broken1,
            broken2,
            another1,
            noHelpline,
            withTaskId,
            oneHourBefore,
            invalidContact,
            oneWeekBefore,
          ].map(c => () =>
            request
              .post(route)
              .set(headers)
              .send(c),
          ),
        );

        createdContacts = responses.map(r => r.body);
      });

      afterAll(async () => {
        await Contact.destroy({
          where: {
            id: {
              [Sequelize.Op.in]: createdContacts.map(c => c.id),
            },
          },
        });

        createdContacts = [];
      });

      each([
        {
          body: { firstName: 'jh', lastName: 'he' },
          changeDescription: 'multiple input search',
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts, count } = response.body;
            expect(count).toBe(2);

            const [c2, c1] = contacts; // result is sorted DESC
            expect(c1.details).toStrictEqual(contact1.form);
            expect(c2.details).toStrictEqual(contact2.form);

            // Test the association
            expect(c1.csamReports).toHaveLength(0);
            expect(c2.csamReports).toHaveLength(0);
          },
        },
        {
          body: { firstName: 'jh', lastName: 'curie' },
          changeDescription: 'multiple input search that targets zero contacts',
          expectCallback: response => {
            const { count } = response.body;
            expect(response.status).toBe(200);
            expect(count).toBe(0);
          },
        },
        {
          changeDescription: 'multiple input search with helpline',
          body: { firstName: 'ma', lastName: 'ur', helpline: 'Helpline 1' }, // should retrieve only the contact with 'Helpline 1'
          expectCallback: response => {
            const { contacts, count } = response.body;

            expect(response.status).toBe(200);
            expect(count).toBe(1);
            const [a] = contacts;
            expect(a.details).toStrictEqual(another1.form);
          },
        },
        {
          changeDescription: 'multiple input search without name search',
          body: { counselor: 'worker-sid' }, // should match contact1 & broken1 & another1 & noHelpline
          expectCallback: response => {
            const { contacts, count } = response.body;

            expect(response.status).toBe(200);
            // invalidContact will return null from the search endpoint, exclude it here
            expect(count).toBe(createdContacts.length - 1);
            const createdConcatdsByTimeOfContact = createdContacts.sort(compareTimeOfContactDesc);
            createdConcatdsByTimeOfContact.forEach(c => {
              const searchContact = contacts.find(results => results.contactId === c.id);
              if (searchContact) {
                // Check that all contacts contains the appropriate info
                expect(c.rawJson).toMatchObject(searchContact.details);
              }
            });
          },
        },
        ...[
          another2.number,
          another2.form.childInformation.location.phone1,
          another2.form.childInformation.location.phone2,
          another2.form.callerInformation.location.phone1,
          another2.form.callerInformation.location.phone2,
        ].map(phone => {
          const phoneNumber = phone.substring(1, 6);

          return {
            changeDescription: 'phone regexp',
            body: { phoneNumber },
            expectCallback: response => {
              const { count, contacts } = response.body;
              expect(response.status).toBe(200);
              expect(count).toBe(1);
              expect(contacts[0].details).toStrictEqual(another2.form);
            },
          };
        }),
        ...[
          another2.number,
          another2.form.childInformation.location.phone1,
          another2.form.childInformation.location.phone2,
          another2.form.callerInformation.location.phone1,
          another2.form.callerInformation.location.phone2,
        ].map(phone => {
          const phoneNumber = phone.substring(1, 6);

          return {
            changeDescription: 'phone regexp & lastName (multi input)',
            body: { phoneNumber, lastName: 'curi' },
            expectCallback: response => {
              const { count, contacts } = response.body;
              expect(response.status).toBe(200);
              expect(count).toBe(1);
              expect(contacts[0].details).toStrictEqual(another2.form);
            },
          };
        }),
        {
          // https://github.com/tech-matters/hrm/pull/33#discussion_r409904466
          changeDescription: 'returns zero contacts (adding the country code)',
          body: { phoneNumber: `+1 ${another2.form.childInformation.location.phone1}` },
          expectCallback: response => {
            const { count } = response.body;

            expect(response.status).toBe(200);
            expect(count).toBe(0);
          },
        },
        ...Array.from(Array(10).keys()).map(n => ({
          changeDescription: `limit set to ${n}`,
          queryParams: `limit=${n}`,
          body: { counselor: 'worker-sid' }, // should match contact1 & broken1 & another1 & noHelpline
          expectCallback: response => {
            expect(response.status).toBe(200);

            // If the limit exceeds the "count" for the query, then it should return the entire match ("count" elements)
            const { count, contacts } = response.body;
            if (n > count) {
              expect(contacts).toHaveLength(count);
            } else {
              expect(contacts).toHaveLength(n);
            }
          },
        })),
        // Should match withTaskId in all cases
        ...[
          { helpline: withTaskId.helpline },
          { firstName: withTaskId.form.childInformation.name.firstName },
          { lastName: withTaskId.form.childInformation.name.lastName },
          { contactNumber: withTaskId.number },
        ].map(body => ({
          changeDescription: JSON.stringify(body),
          body,
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts } = response.body;

            expect(contacts).toHaveLength(1);
            expect(contacts[0].details).toMatchObject(withTaskId.form);
          },
        })),
        {
          changeDescription: 'Test date filters (should match oneWeekBefore only)',
          body: {
            dateFrom: new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 8).toISOString(),
            dateTo: new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          },
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts } = response.body;

            expect(contacts).toHaveLength(1);
            expect(contacts[0].details).toMatchObject(noHelpline.form);
          },
        },
        {
          changeDescription: 'Test date filters (should all but oneWeekBefore)',
          body: {
            dateFrom: new Date().toISOString(),
          },
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts } = response.body;

            // Expect all but invalid and oneWeekBefore
            expect(contacts).toHaveLength(createdContacts.length - 2);
            const createdConcatdsByTimeOfContact = createdContacts.sort(compareTimeOfContactDesc);
            createdConcatdsByTimeOfContact.forEach(c => {
              const searchContact = contacts.find(results => results.contactId === c.id);
              if (searchContact) {
                // Check that all contacts contains the appropriate info
                expect(c.rawJson).toMatchObject(searchContact.details);
              }
            });
          },
        },
      ]).test(
        'should return 200 with $changeDescription',
        async ({ expectCallback, queryParams = '', body = {} }) => {
          const response = await request
            .post(`${subRoute}?${queryParams}`)
            .set(headers)
            .send(body); // should filter non-data

          expectCallback(response);
        },
      );
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

      // const selectCreatedCaseAudits = () =>
      // `SELECT * FROM "Audits" WHERE "tableName" = 'Cases' AND ("oldRecord"->>'id' = '${createdCase.id}' OR "newRecord"->>'id' = '${createdCase.id}')`;
      const countCasesAudits = async () =>
        parseInt(
          (
            await db.task(t => t.any(`SELECT COUNT(*) FROM "Audits" WHERE "tableName" = 'Cases'`))
          )[0].count,
          10,
        );

      const selectCasesAudits = () =>
        db.task(t => t.any(`SELECT * FROM "Audits" WHERE "tableName" = 'Cases'`));

      const countContactsAudits = async () =>
        parseInt(
          (
            await db.task(t =>
              t.any(`SELECT COUNT(*) FROM "Audits" WHERE "tableName" = 'Contacts'`),
            )
          )[0].count,
          10,
        );
      const selectContactsAudits = () =>
        db.task(t => t.any(`SELECT * FROM "Audits" WHERE "tableName" = 'Contacts'`));

      test('should create a CaseAudit', async () => {
        const casesAuditPreviousCount = await countCasesAudits();
        const contactsAuditPreviousCount = await countContactsAudits();

        const response = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        expect(response.status).toBe(200);

        const casesAudits = await selectCasesAudits();
        const contactsAudits = await selectContactsAudits();

        // Connecting contacts to cases does not update Cases, but Contacts
        expect(casesAudits).toHaveLength(casesAuditPreviousCount);
        expect(contactsAudits).toHaveLength(contactsAuditPreviousCount + 1);

        const lastContactAudit = contactsAudits.sort(byGreaterId)[0];
        const { oldRecord, newRecord } = lastContactAudit;

        expect(oldRecord.caseId).toBe(null);
        expect(newRecord.caseId).toBe(existingCaseId);
      });

      // I believe this behavior is dependant on Sequelize, and will change once we get rid of it
      test('Idempotence on connect contact to case (does not generates extra Contacts audit if caseId has no changed)', async () => {
        const response1 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        expect(response1.status).toBe(200);

        const casesAuditPreviousCount = await countCasesAudits();
        const contactsAuditPreviousCount = await countContactsAudits();

        // repeat above operation (should do nothing but emit an audit)
        const response2 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        expect(response2.status).toBe(200);

        const casesAuditAfterCount = await countCasesAudits();
        const contactsAuditAfterCount = await countContactsAudits();

        expect(casesAuditAfterCount).toBe(casesAuditPreviousCount);
        expect(contactsAuditAfterCount).toBe(contactsAuditPreviousCount);
      });

      test('Should create audit for a Contact if caseId changes', async () => {
        const response1 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: existingCaseId });

        expect(response1.status).toBe(200);

        const casesAuditPreviousCount = await countCasesAudits();
        const contactsAuditPreviousCount = await countContactsAudits();

        // repeat above operation (should do nothing but emit an audit)
        const response2 = await request
          .put(subRoute(existingContactId))
          .set(headers)
          .send({ caseId: anotherExistingCaseId });

        expect(response2.status).toBe(200);

        const casesAuditAfterCount = await countCasesAudits();
        const contactsAuditAfterCount = await countContactsAudits();

        expect(casesAuditAfterCount).toBe(casesAuditPreviousCount);
        expect(contactsAuditAfterCount).toBe(contactsAuditPreviousCount + 1);
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
