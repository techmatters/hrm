/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import each from 'jest-each';
import { addSeconds, parseISO, subDays, subHours, subSeconds } from 'date-fns';
// import { formatInTimeZone } from 'date-fns-tz';

import { isS3StoredTranscript } from '@tech-matters/hrm-core/conversation-media/conversationMedia';
import {
  accountSid,
  ALWAYS_CAN,
  another1,
  another2,
  broken1,
  broken2,
  contact1,
  contact2,
  conversationMedia,
  noHelpline,
  nonData1,
  nonData2,
  withTaskId,
  workerSid,
} from '../mocks';
import '../case/caseValidation';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import { ruleFileActionOverride } from '../permissions-overrides';
import * as csamReportApi from '@tech-matters/hrm-core/csam-report/csamReportService';
import { headers, setRules, useOpenRules } from '../server';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';

import { addConversationMediaToContact } from '@tech-matters/hrm-core/contact/contactService';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import supertest from 'supertest';
import { setupServiceTests } from '../setupServiceTest';

/**
 *
 * @param {(() => Promise<any>)[]} ps
 * @returns
 */
const resolveSequentially = async (ps: Promise<unknown>[]) => {
  const ret = [];
  for (const p of ps) {
    ret.push(await p);
  }
  return ret;
};

const { request } = setupServiceTests();

const compareTimeOfContactDesc = (c1, c2) =>
  new Date(c2.timeOfContact).valueOf() - new Date(c1.timeOfContact).valueOf();

describe('/contacts/search route', () => {
  const subRoute = `/v0/accounts/${accountSid}/contacts/search`;

  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(subRoute).send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    let createdContacts: contactDb.Contact[] = [];
    let csamReports = new Array<csamReportApi.CSAMReport>();
    const [currentUTCDateString] = new Date().toISOString().split('T');

    const startTestsTimeStamp = parseISO(`${currentUTCDateString}T06:00:00.000Z`);

    beforeEach(async () => {
      // Create CSAM Reports
      const csamReportId1 = 'csam-report-id-1';
      const csamReportId2 = 'csam-report-id-2';

      const newReport1 = await csamReportApi.createCSAMReport(
        {
          csamReportId: csamReportId1,
          twilioWorkerId: workerSid,
          reportType: 'self-generated',
        },
        accountSid,
      );

      const newReport2 = await csamReportApi.createCSAMReport(
        {
          csamReportId: csamReportId2,
          twilioWorkerId: workerSid,
          reportType: 'self-generated',
        },
        accountSid,
      );

      // Create some contacts to work with
      const oneHourBefore = {
        ...another2,
        taskId: 'oneHourBefore-tasksid-2',
        timeOfContact: subHours(startTestsTimeStamp, 1).toISOString(), // one hour before
      };

      const oneWeekBefore = {
        ...noHelpline,
        taskId: 'oneWeekBefore-tasksid-2',
        timeOfContact: subDays(startTestsTimeStamp, 7).toISOString(), // one hour before
      };

      const withCSAMReports = {
        ...noHelpline,
        taskId: 'withCSAMReports-tasksid-2',
        queueName: 'withCSAMReports',
        number: '123412341234',
      };
      createdContacts = await resolveSequentially(
        [
          { ...contact1, taskId: 'contact1-tasksid-2' },
          { ...contact2, taskId: 'contact2-tasksid-2' },
          broken1,
          broken2,
          nonData1,
          nonData2,
          another1,
          noHelpline,
          withTaskId,
          oneHourBefore,
          // invalidContact as NewContactRecord,
          withCSAMReports,
          oneWeekBefore,
        ].map(c => contactApi.createContact(accountSid, workerSid, c, ALWAYS_CAN, true)),
      );

      const withCSAMReportsId = createdContacts.find(
        c => c.queueName === 'withCSAMReports',
      )!.id;
      await Promise.all(
        [newReport1, newReport2].map(report =>
          csamReportApi.createCSAMReport(
            { ...report, contactId: withCSAMReportsId },
            accountSid,
          ),
        ),
      );
      // Retrieve the csam reports that should be connected to withCSAMReports
      const updatedCsamReports = await csamReportApi.getCsamReportsByContactId(
        withCSAMReportsId,
        accountSid,
      );
      expect(updatedCsamReports).toHaveLength(2);
      csamReports = updatedCsamReports;
    });

    type SearchTestCase = {
      body: any;
      changeDescription: string;
      expectCallback: (
        response: Omit<supertest.Response, 'body'> & {
          body: { contacts: contactDb.Contact[]; count: number };
        },
      ) => void;
    };

    const testCases: SearchTestCase[] = [
      {
        body: { firstName: 'jh', lastName: 'he' },
        changeDescription: 'multiple input search',
        expectCallback: response => {
          // Name based filters remove non data contacts regardless of setting?
          expect(response.status).toBe(200);
          const { contacts, count } = response.body;

          const c1 = contacts.find(c => c.id === createdContacts[0].id);
          const c2 = contacts.find(c => c.id === createdContacts[1].id);
          expect(c1.rawJson).toStrictEqual(contact1.rawJson);
          expect(c2.rawJson).toStrictEqual(contact2.rawJson);

          // Test the association
          expect(c1.csamReports).toHaveLength(0);
          expect(c2.csamReports).toHaveLength(0);
          // Test the association
          expect(c1.taskId).toBe('contact1-tasksid-2');
          expect(c2.taskId).toBe('contact2-tasksid-2');
          expect(count).toBe(2);
          expect(contacts.length).toBe(2);
          expect(parseISO(contacts[0].timeOfContact).getTime()).toBeGreaterThanOrEqual(
            parseISO(contacts[1].timeOfContact).getTime(),
          );
        },
      },
      {
        body: { firstName: 'jh', lastName: 'he', onlyDataContacts: true },
        changeDescription: 'multiple input search (data contacts only)',
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts, count } = response.body;

          const c1 = contacts.find(c => c.id === createdContacts[0].id);
          const c2 = contacts.find(c => c.id === createdContacts[1].id);
          expect(c1.rawJson).toStrictEqual(contact1.rawJson);
          expect(c2.rawJson).toStrictEqual(contact2.rawJson);

          // Test the association
          expect(c1.csamReports).toHaveLength(0);
          expect(c2.csamReports).toHaveLength(0);
          // Test the association
          expect(c1.taskId).toBe('contact1-tasksid-2');
          expect(c2.taskId).toBe('contact2-tasksid-2');
          expect(count).toBe(2);
          expect(contacts.length).toBe(2);
          expect(parseISO(contacts[0].timeOfContact).getTime()).toBeGreaterThanOrEqual(
            parseISO(contacts[1].timeOfContact).getTime(),
          );
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
          expect(a.rawJson).toStrictEqual(another1.rawJson);
        },
      },
      {
        changeDescription: 'multiple input search without name search',
        body: { counselor: workerSid }, // should match contact1 & broken1 & another1 & noHelpline
        expectCallback: response => {
          const { contacts } = response.body as { contacts: contactDb.Contact[] };

          expect(response.status).toBe(200);
          // invalidContact will return null from the search endpoint, exclude it here
          expect(contacts.length).toBe(createdContacts.length);
          const createdContactsByTimeOfContact = createdContacts.sort(
            compareTimeOfContactDesc,
          );
          createdContactsByTimeOfContact.forEach(c => {
            const searchContact = contacts.find(results => results.id === c.id);
            if (searchContact) {
              // Check that all contacts contains the appropriate info
              expect(c.rawJson).toMatchObject(searchContact.rawJson);
            }
          });
        },
      },
      {
        changeDescription:
          'multiple input search without name search excluding non data contacts',
        body: { counselor: workerSid, onlyDataContacts: true }, // should match contact1 & broken1 & another1 & noHelpline
        expectCallback: response => {
          const { contacts } = response.body;

          expect(response.status).toBe(200);
          // nonData1, nonData2, broken1 and broken2 are not data contact types
          expect(contacts.length).toBe(createdContacts.length - 4);
          const createdContactsByTimeOfContact = createdContacts.sort(
            compareTimeOfContactDesc,
          );
          createdContactsByTimeOfContact
            .filter(
              c =>
                c.rawJson &&
                ['Child calling about self', 'Someone calling about a child'].includes(
                  c.rawJson.callType,
                ),
            )
            .forEach(c => {
              const searchContact = contacts.find(result => result.id === c.id);
              if (searchContact) {
                // Check that all contacts contains the appropriate info
                expect(c.rawJson).toMatchObject(searchContact.rawJson);
              }
            });
        },
      },
      ...[
        another2.number,
        another2.rawJson.childInformation.phone1 as string,
        another2.rawJson.childInformation.phone2 as string,
        another2.rawJson.callerInformation.phone1 as string,
        another2.rawJson.callerInformation.phone2 as string,
      ].map(phone => {
        const phoneNumber = phone.substring(1, 6);

        return {
          changeDescription: 'phone regexp',
          body: { phoneNumber },
          expectCallback: response => {
            const { count, contacts } = response.body as {
              count: number;
              contacts: contactDb.Contact[];
            };
            expect(response.status).toBe(200);
            expect(count).toBe(1);
            expect(contacts[0].rawJson).toStrictEqual(another2.rawJson);
          },
        };
      }),
      ...[
        another2.number,
        another2.rawJson.childInformation.phone1,
        another2.rawJson.childInformation.phone2,
        another2.rawJson.callerInformation.phone1,
        another2.rawJson.callerInformation.phone2,
      ].map(phone => {
        const phoneNumber = phone.toString().substring(1, 6);

        return {
          changeDescription: 'phone regexp & lastName (multi input)',
          body: { phoneNumber, lastName: 'curi' },
          expectCallback: response => {
            const { count, contacts } = response.body as {
              count: number;
              contacts: contactDb.Contact[];
            };
            expect(response.status).toBe(200);
            expect(count).toBe(1);
            expect(contacts[0].rawJson).toStrictEqual(another2.rawJson);
          },
        };
      }),
      {
        // https://github.com/tech-matters/hrm/pull/33#discussion_r409904466
        changeDescription: 'returns zero contacts (adding the country code)',
        body: { phoneNumber: `+1 ${another2.rawJson.childInformation.phone1}` },
        expectCallback: response => {
          const { count } = response.body;

          expect(response.status).toBe(200);
          expect(count).toBe(0);
        },
      },
      ...Array.from(Array(10).keys()).map(n => ({
        changeDescription: `limit set to ${n}`,
        queryParams: `limit=${n}`,
        body: { counselor: workerSid }, // should match contact1 & broken1 & another1 & noHelpline
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
        { firstName: withTaskId.rawJson.childInformation.firstName },
        { lastName: withTaskId.rawJson.childInformation.lastName },
        { contactNumber: withTaskId.number },
      ].map(body => ({
        changeDescription: JSON.stringify(body),
        body,
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts } = response.body as { contacts: contactDb.Contact[] };

          expect(contacts).toHaveLength(1);
          expect(contacts[0].rawJson).toMatchObject(withTaskId.rawJson);
        },
      })),
      {
        changeDescription: 'Test date filters (should match oneWeekBefore only)',
        body: {
          dateFrom: subDays(startTestsTimeStamp, 8).toISOString(),
          dateTo: subDays(startTestsTimeStamp, 5).toISOString(),
        },
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts } = response.body;

          expect(contacts).toHaveLength(1);
          expect(contacts[0].rawJson).toMatchObject(noHelpline.rawJson);
        },
      },
      {
        changeDescription: 'Test date filters (should match oneWeekBefore only)',
        body: {
          dateFrom: subDays(startTestsTimeStamp, 8).toISOString(),
          dateTo: subDays(startTestsTimeStamp, 5).toISOString(),
        },
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts } = response.body;

          expect(contacts).toHaveLength(1);
          expect(contacts[0].rawJson).toMatchObject(noHelpline.rawJson);
        },
      },
      {
        changeDescription: 'Test date filters (should all but oneWeekBefore)',
        body: {
          dateFrom: subHours(startTestsTimeStamp, 1).toISOString(),
        },
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts } = response.body;

          // Expect all but invalid and oneWeekBefore
          expect(contacts).toHaveLength(createdContacts.length - 1);
          const createdContactsByTimeOfContact = createdContacts.sort(
            compareTimeOfContactDesc,
          );
          createdContactsByTimeOfContact.forEach(c => {
            const searchContact = contacts.find(result => result.id === c.id);
            if (searchContact) {
              // Check that all contacts contains the appropriate info
              expect(c.rawJson).toMatchObject(searchContact.rawJson);
            }
          });
        },
      },
      {
        changeDescription:
          'with date filters as local times - should apply them correctly adjusted',
        body: {
          dateFrom: formatInTimeZone(
            startTestsTimeStamp,
            '-06:00',
            'yyyy-MM-dd HH:mm:ssXXX',
          ),
        },
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts } = response.body;

          // Expect all but invalid and oneWeekBefore
          expect(contacts).toHaveLength(createdContacts.length - 2);
          const createdContactsByTimeOfContact = createdContacts.sort(
            compareTimeOfContactDesc,
          );
          createdContactsByTimeOfContact.forEach(c => {
            const searchContact = contacts.find(result => result.id === c.id);
            if (searchContact) {
              // Check that all contacts contains the appropriate info
              expect(c.rawJson).toMatchObject(searchContact.rawJson);
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
          const withCSAMReports = createdContacts.find(
            c => c.queueName === 'withCSAMReports',
          );

          if (!withCSAMReports) {
            throw new Error('withCSAMReports is undefined');
          }

          expect(contacts.find(c => withCSAMReports.id === c.id)).toBeDefined();
          expect(contacts[0].rawJson).toMatchObject(withCSAMReports.rawJson);
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
        body: {
          firstName: 'jh',
          lastName: 'he',
          counselor: '',
          contactNumber: '',
          helpline: '',
        },
        changeDescription: 'empty strings should be ignored',
        expectCallback: response => {
          expect(response.status).toBe(200);
          const { contacts, count } = response.body;
          expect(count).toBe(2);

          const c1 = contacts.find(c => c.id === createdContacts[0].id);
          const c2 = contacts.find(c => c.id === createdContacts[1].id);
          expect(c1.rawJson).toStrictEqual(contact1.rawJson);
          expect(c2.rawJson).toStrictEqual(contact2.rawJson);
          // Test the association
          expect(c1.csamReports).toHaveLength(0);
          expect(c2.csamReports).toHaveLength(0);
        },
      },
    ];

    each(testCases).test(
      'should return 200 with $changeDescription',
      async ({ expectCallback, queryParams = '', body = {} }) => {
        const response = await request
          .post(`${subRoute}?${queryParams}`)
          .set(headers)
          .send(body); // should filter non-data

        expectCallback(response);
      },
    );

    each([
      {
        expectTranscripts: true,
        description: `with viewExternalTranscript includes transcripts`,
      },
      {
        expectTranscripts: false,
        description: `without viewExternalTranscript excludes transcripts`,
      },
    ]).test(`$description`, async ({ expectTranscripts }) => {
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        withTaskId,
        { user: newTwilioUser(accountSid, workerSid, []), can: () => true },
        true,
      );
      const createdAtDate = parseISO(createdContact.createdAt);
      await addConversationMediaToContact(
        accountSid,
        createdContact.id.toString(),
        conversationMedia,
        { user: newTwilioUser(accountSid, workerSid, []), can: () => true },
        true,
      );

      useOpenRules();
      if (!expectTranscripts) {
        setRules(ruleFileActionOverride('viewExternalTranscript', false));
      }

      const res = await request
        .post(`/v0/accounts/${accountSid}/contacts/search`)
        .set(headers)
        .send({
          dateFrom: subSeconds(createdAtDate, 1).toISOString(),
          dateTo: addSeconds(createdAtDate, 1).toISOString(),
          firstName: 'withTaskId',
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);

      if (expectTranscripts) {
        expect(
          res.body.contacts[0].conversationMedia?.some(isS3StoredTranscript),
        ).toBeTruthy();
        expect(
          res.body.contacts[0].conversationMedia?.some(cm => cm.storeType === 'S3'),
        ).toBeTruthy();
      } else {
        expect(
          res.body.contacts[0].conversationMedia?.some(isS3StoredTranscript),
        ).toBeFalsy();
        expect(
          res.body.contacts[0].conversationMedia?.some(cm => cm.storeType === 'S3'),
        ).toBeFalsy();
      }
      useOpenRules();
    });

    test('CSAM reports are filtered if not acknowledged', async () => {
      // Create CSAM Report
      const csamReportId1 = 'csam-report-id-1';
      const csamReportId2 = 'csam-report-id-2';
      const csamReportId3 = 'csam-report-id-2';

      const contactToCreate: NewContactRecord = {
        ...withTaskId,
        taskId: 'Test CSAM filter',
      };
      // Very specific first name
      contactToCreate.rawJson.childInformation.firstName = 'Test CSAM filter';
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        contactToCreate,
        { user: newTwilioUser(accountSid, workerSid, []), can: () => true },
        true,
      );

      const newReport1 = await csamReportApi.createCSAMReport(
        {
          contactId: createdContact.id,
          csamReportId: csamReportId1,
          twilioWorkerId: workerSid,
          reportType: 'self-generated',
        },
        accountSid,
      );

      await csamReportApi.createCSAMReport(
        {
          contactId: createdContact.id,
          csamReportId: csamReportId2,
          twilioWorkerId: workerSid,
          reportType: 'counsellor-generated',
        },
        accountSid,
      );

      // This one should not be retrieved
      const newReport3 = await csamReportApi.createCSAMReport(
        {
          contactId: createdContact.id,
          csamReportId: csamReportId3,
          twilioWorkerId: workerSid,
          reportType: 'self-generated',
        },
        accountSid,
      );

      await csamReportApi.acknowledgeCsamReport(newReport1.id, accountSid);

      const res = await request
        .post(`/v0/accounts/${accountSid}/contacts/search`)
        .set(headers)
        .send({
          firstName: 'Test CSAM filter',
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);

      expect(res.body.contacts[0].csamReports).toHaveLength(2);
      expect(
        res.body.contacts[0].csamReports.find(r => r.id === newReport3.id),
      ).toBeFalsy();
    });
  });
});
