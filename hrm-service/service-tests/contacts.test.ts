import supertest from 'supertest';
import * as Sequelize from 'sequelize';
// eslint-disable-next-line prettier/prettier
import type { ContactRawJson } from '../src/contact/contact-json';
import { createService } from '../src/app';
const models = require('../src/models');
import each  from 'jest-each';
import mocks from './mocks';
import { db } from '../src/connection-pool';
import { subHours, subDays } from 'date-fns';

import './case-validation';
import * as caseApi from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import { PatchPayload } from '../src/contact/contact';
import * as contactApi from '../src/contact/contact';
import * as contactDb from '../src/contact/contact-data-access';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
}).listen();
const request = supertest.agent(server, undefined);

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
  workerSid,
} = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

const { CSAMReport } = models;
const CSAMReportController = require('../src/controllers/csam-report-controller')(CSAMReport);

const cleanupWhereClause = `
  WHERE "twilioWorkerId" IN ('fake-worker-123', 'fake-worker-129', 'fake-worker-987', '${workerSid}') OR "accountSid" IN ('', '${accountSid}');
`;

const cleanupCases = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "Cases" 
      ${cleanupWhereClause}
  `),
  );

const cleanupContacts = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "Contacts" 
      ${cleanupWhereClause}
  `),
  );

/**
 * We could move this to contact data access, but since is something we only want in test suits, it might be better this way
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteContactById = (id: number, accountSid: string) => 
  db.task(t =>
    t.none(`
      DELETE FROM "Contacts" 
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
  `),
  );


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
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
  await CSAMReport.destroy(query);
  await cleanupContacts();
  await cleanupCases();
});

afterAll(async () => {
  await CSAMReport.destroy(query);
  await cleanupContacts();
  await cleanupCases();
  await proxiedEndpoints.stop();
  await server.close();
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

        const createdContact = await contactDb.getById(accountSid, res.body.id);
        expect(createdContact).toBeDefined();

        expect(createdContact.rawJson).toMatchObject(expected.form);
        expect(createdContact.timeOfContact).toParseAsDate();
        expect(createdContact.createdAt).toParseAsDate();
        expect(createdContact.twilioWorkerId).toBe(expected.twilioWorkerId);
        expect(createdContact.helpline).toBe(expected.helpline);
        expect(createdContact.queueName).toBe(
          expected.queueName || expected.form.queueName || null,
        );
        expect(createdContact.number).toBe(expected.number);
        expect(createdContact.channel).toBe(expected.channel);
        expect(createdContact.conversationDuration).toBe(expected.conversationDuration);
      },
    );

    test('Idempotence on create contact', async () => {
      const response = await request
        .post(route)
        .set(headers)
        .send(withTaskId);
      const subsequentResponse = await request
        .post(route)
        .set(headers)
        .send(withTaskId);

      // both should succeed
      expect(response.status).toBe(200);
      expect(subsequentResponse.status).toBe(200);

      // but should both return the same entity (i.e. the second call didn't create one)
      expect(subsequentResponse.body.id).toBe(response.body.id);
    });

    test('Connects to CSAM reports (not existing csam report id, do nothing)', async () => {
      const notExistingCsamReport = { id: 99999999 };

      // Create contact with above report
      const response = await request
        .post(route)
        .set(headers)
        .send({ ...contact1, csamReports: [notExistingCsamReport] });


      // Test the association
      expect(response.status).toBe(200);

      // Test the association
      expect(response.body.csamReports).toHaveLength(0);

      // No new report is created
      await expect(
        CSAMReportController.getCSAMReport(notExistingCsamReport.id, accountSid),
      ).rejects.toThrow(`CSAM Report with id ${notExistingCsamReport.id} not found`);

      await deleteContactById(response.body.id, response.body.accountSid);
    });

    test('Connects to CSAM reports (valid csam reports ids)', async () => {

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

      // Remove records to not interfere with following tests
      await CSAMReport.destroy({ where: { contactId: response.body.id } });
      await deleteContactById(response.body.id, response.body.accountSid);
    });
  });

  const compareTimeOfContactDesc = (c1, c2) =>
    new Date(c2.timeOfContact).valueOf() - new Date(c1.timeOfContact).valueOf();

  describe('/contacts/search route', () => {
    const subRoute = `${route}/search`;

    describe('POST', () => {
      test('should return 401', async () => {
        const response = await request.post(subRoute).send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      let createdContacts: contactDb.Contact[] = [];
      let csamReports = [];
      beforeAll(async () => {
        // Clean what's been created so far
        await CSAMReport.destroy(query);
        await cleanupContacts();
        await cleanupCases();

        // Create CSAM Reports
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

        // Create some contacts to work with
        const oneHourBefore = {
          ...another2,
          timeOfContact: subHours(new Date(), 1).toISOString(), // one hour before
        };

        const oneWeekBefore = {
          ...noHelpline,
          timeOfContact: subDays(new Date(), 7).toISOString(), // one hour before
        };

        const invalidContact = {};

        const withCSAMReports = {
          ...noHelpline,
          queueName: 'withCSAMReports',
          number: '123412341234',
          csamReports: [newReport1, newReport2],
        };

        const responses = await resolveSequentially(
          [
            { ...contact1, taskId: 'contact-1-task' },
            { ...contact2, taskId: 'contact-2-task' },
            broken1,
            broken2,
            another1,
            noHelpline,
            withTaskId,
            oneHourBefore,
            invalidContact,
            withCSAMReports,
            oneWeekBefore,
          ].map(c => () =>
            request
              .post(route)
              .set(headers)
              .send(c),
          ),
        );

        createdContacts = responses.map(r => r.body);
        const withCSAMReportsId = createdContacts.find(c => c.queueName === 'withCSAMReports')?.id;
        // Retrieve the csam reports that should be connected to withCSAMReports
        const updatedCsamReports = await CSAMReportController.getCSAMReports(
          withCSAMReportsId,
          accountSid,
        );
        expect(updatedCsamReports).toHaveLength(2);
        csamReports = updatedCsamReports;
      });

      afterAll(async () => {
        await CSAMReport.destroy({
          where: {
            id: {
              [Sequelize.Op.in]: csamReports.map(c => c.id),
            },
          },
        });
        await Promise.all(createdContacts.filter(c => c.id).map(c => deleteContactById(c.id, c.accountSid)));
      });

      each([
        {
          body: { firstName: 'jh', lastName: 'he' },
          changeDescription: 'multiple input search',
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts } = response.body;
            //expect(count).toBe(2);

            const [c2, c1] = contacts; // result is sorted DESC
            expect(c1.details).toStrictEqual(contact1.form);
            expect(c2.details).toStrictEqual(contact2.form);

            // Test the association
            expect(c1.csamReports).toHaveLength(0);
            expect(c2.csamReports).toHaveLength(0);
            // Test the association
            expect(c1.overview.taskId).toBe('contact-1-task');
            expect(c2.overview.taskId).toBe('contact-2-task');
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
            const { contacts } = response.body;

            expect(response.status).toBe(200);
            // invalidContact will return null from the search endpoint, exclude it here
            expect(contacts.length).toBe(createdContacts.length - 1);
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
            dateFrom: subDays(new Date(), 8).toISOString(),
            dateTo: subDays(new Date(), 5).toISOString(),
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
        {
          changeDescription:
            'withCSAMReports (filter by contactNumber and check csam reports are retrieved)',
          body: { contactNumber: '123412341234' },
          expectCallback: response => {
            expect(response.status).toBe(200);

            const { contacts } = response.body;
            expect(contacts.length).toBe(1);
            console.log(contacts[0]);
            const withCSAMReports = createdContacts.find(c => c.queueName === 'withCSAMReports');

            expect(contacts.find(c => withCSAMReports.id.toString() === c.contactId)).toBeDefined();
            expect(contacts[0].details).toMatchObject(withCSAMReports.rawJson);
            contacts[0].csamReports.forEach(r => {
              expect(csamReports.find(r2 => r2.id === r.id)).toMatchObject({
                ...r,
                createdAt: expect.toParseAsDate(r.createdAt),
                updatedAt: expect.toParseAsDate(r.updatedAt),
              });
            });
          },
        },
        {
          body: { firstName: 'jh', lastName: 'he', counselor: '', contactNumber: '', helpline: '' },
          changeDescription: 'empty strings should be ignored',
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts } = response.body;
            //expect(count).toBe(2);

            const [c2, c1] = contacts; // result is sorted DESC
            expect(c1.details).toStrictEqual(contact1.form);
            expect(c2.details).toStrictEqual(contact2.form);

            // Test the association
            expect(c1.csamReports).toHaveLength(0);
            expect(c2.csamReports).toHaveLength(0);
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

  describe('/contacts/:contactId route', () => {
    describe('PATCH', () => {
      type TestOptions = {
        patch: PatchPayload['rawJson'];
        description: string;
        original?: ContactRawJson;
        expected: Partial<ContactRawJson>;
      };
      const subRoute = contactId => `${route}/${contactId}`;

      test('should return 401', async () => {
        const createdContact = await contactApi.createContact(accountSid, workerSid, { ...contact1, rawJson: {} });
        try {
          const response = await request.patch(subRoute(createdContact.id)).send({});

          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Authorization failed');
        } finally {
          await deleteContactById(createdContact.id, createdContact.accountSid);
        }
      });
      describe('Blank rawJson', () => {
        const sampleRawJson = {
          ...contact1.form,
          caseInformation: {
            ...contact1.form.caseInformation,
            categories: {
              a: {
                a1: false,
                a2: true,
              },
              b: {
                b1: true,
                b2: false,
              },
            },
          },
        };
        each(<TestOptions[]>[
          {
            description: 'add child information',
            patch: {
              childInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'property',
              },
            },
            expected: {
              childInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'property',
              },
            },
          },
          {
            description: 'add caller information',
            patch: {
              callerInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'other property',
              },
            },
            expected: {
              callerInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'other property',
              },
            },
          },
          {
            description: 'add case information and categories',
            patch: {
              caseInformation: {
                other: 'case property',
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
            expected: {
              caseInformation: {
                other: 'case property',
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
          },
          {
            description: 'add case information',
            patch: {
              caseInformation: {
                other: 'case property',
              },
            },
            expected: {
              caseInformation: {
                other: 'case property',
              },
            },
          },
          {
            description: 'add categories',
            patch: {
              caseInformation: {
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
            expected: {
              caseInformation: {
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
          },
          {
            description: 'overwrite child information',
            original: sampleRawJson,
            patch: {
              childInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'property',
              },
            },
            expected: {
              ...sampleRawJson,
              childInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'property',
              },
            },
          },
          {
            original: sampleRawJson,
            description: 'overwrite caller information',
            patch: {
              callerInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'other property',
              },
            },
            expected: {
              ...sampleRawJson,
              callerInformation: {
                name: { firstName: 'Lorna', lastName: 'Ballantyne' },
                some: 'other property',
              },
            },
          },
          {
            original: sampleRawJson,
            description: 'overwrite case information and categories',
            patch: {
              caseInformation: {
                other: 'overwrite case property',
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
            expected: {
              ...sampleRawJson,
              caseInformation: {
                other: 'overwrite case property',
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
          },
          {
            original: sampleRawJson,
            description: 'overwrite case information',
            patch: {
              caseInformation: {
                other: 'case property',
              },
            },
            expected: {
              ...sampleRawJson,
              caseInformation: {
                other: 'case property',
                categories: sampleRawJson.caseInformation.categories,
              },
            },
          },
          {
            original: sampleRawJson,
            description: 'overwrite categories',
            patch: {
              caseInformation: {
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
            expected: {
              ...sampleRawJson,
              caseInformation: {
                ...sampleRawJson.caseInformation,
                categories: {
                  category1: {
                    subcategory1: true,
                    subcategory2: true,
                  },
                },
              },
            },
          },
        ]).test(
          'should $description if that is specified in the payload',
          async ({ patch, original, expected }: TestOptions) => {
            console.log('expected:', expected);
            const createdContact = await contactApi.createContact(accountSid, workerSid, { ...contact1, rawJson: original || {} });
            try {
              const existingContactId = createdContact.id;
              const response = await request
                .patch(subRoute(existingContactId))
                .set(headers)
                .send({ rawJson: patch });

              expect(response.status).toBe(200);
              expect(response.body).toStrictEqual({
                ...createdContact,
                timeOfContact: expect.toParseAsDate(createdContact.timeOfContact),
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                updatedAt: expect.toParseAsDate(),
                updatedBy: workerSid,
                rawJson: expected,
                csamReports: [],
              });
              // Test the association
              expect(response.body.csamReports).toHaveLength(0);
              const savedContact = await contactDb.getById(
                accountSid,
                existingContactId,
              );

              expect(savedContact).toStrictEqual({
                ...createdContact,
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                updatedAt: expect.toParseAsDate(),
                updatedBy: workerSid,
                rawJson: expected,
                csamReports: [],
              });
            } finally {
              await deleteContactById(createdContact.id, createdContact.accountSid);
            }
          },
        );
      });

      test('use non-existent contactId should return 404', async () => {
        const contactToBeDeleted = await contactApi.createContact(accountSid, workerSid, contact1);
        const nonExistingContactId = contactToBeDeleted.id;
        await deleteContactById(contactToBeDeleted.id, contactToBeDeleted.accountSid);
        const response = await request
        .patch(subRoute(nonExistingContactId))
        .set(headers)
        .send({
            rawJson: {
              name: { firstName: 'Lorna', lastName: 'Ballantyne' },
              some: 'property',
            },
          });

          expect(response.status).toBe(404);
        });
        
        test('malformed payload should return 400', async () => {
        const contactToBeDeleted = await contactApi.createContact(accountSid, workerSid, contact1);
        const nonExistingContactId = contactToBeDeleted.id;
        await deleteContactById(contactToBeDeleted.id, contactToBeDeleted.accountSid);
        const response = await request
        .patch(subRoute(nonExistingContactId))
          .set(headers)
          .send({
            notRawJson: { some: 'crap' },
          });

        expect(response.status).toBe(400);
      });

      test('no body should return 400', async () => {
        const contactToBeDeleted = await contactApi.createContact(accountSid, workerSid, contact1);
        const nonExistingContactId = contactToBeDeleted.id;
        await deleteContactById(contactToBeDeleted.id, contactToBeDeleted.accountSid);
        const response = await request
        .patch(subRoute(nonExistingContactId))
          .set(headers)
          .send();
          
          expect(response.status).toBe(400);
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
      createdContact = await contactApi.createContact(accountSid, workerSid, contact1);
      createdCase = await caseApi.createCase(case1, accountSid, workerSid);
      anotherCreatedCase = await caseApi.createCase(case2, accountSid, workerSid);
      const contactToBeDeleted = await contactApi.createContact(accountSid, workerSid, contact1);
      const caseToBeDeleted = await caseApi.createCase(case1, accountSid, workerSid);
      
      existingContactId = createdContact.id;
      existingCaseId = createdCase.id;
      anotherExistingCaseId = anotherCreatedCase.id;
      nonExistingContactId = contactToBeDeleted.id;
      nonExistingCaseId = caseToBeDeleted.id;
      
      await deleteContactById(contactToBeDeleted.id, contactToBeDeleted.accountSid);
      await caseDb.deleteById(caseToBeDeleted.id, accountSid);
    });
    
    afterEach(async () => {
      await deleteContactById(createdContact.id, createdContact.accountSid);
      await caseDb.deleteById(createdCase.id, accountSid);
      await caseDb.deleteById(anotherCreatedCase.id, accountSid);
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

      test('Idempotence on connect contact to case - generates audit', async () => {
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
        expect(response2.body.caseId).toBe(existingCaseId);

        const casesAuditAfterCount = await countCasesAudits();
        const contactsAuditAfterCount = await countContactsAudits();

        expect(casesAuditAfterCount).toBe(casesAuditPreviousCount);
        expect(contactsAuditAfterCount).toBe(contactsAuditPreviousCount + 1);
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
