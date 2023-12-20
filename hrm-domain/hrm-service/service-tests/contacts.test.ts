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
import { formatInTimeZone } from 'date-fns-tz';

import { db } from '../src/connection-pool';
import { ContactRawJson } from '../src/contact/contact-json';
import {
  isS3StoredTranscript,
  NewConversationMedia,
  S3ContactMediaType,
} from '../src/conversation-media/conversation-media';
import {
  accountSid,
  another1,
  another2,
  broken1,
  broken2,
  case1,
  case2,
  contact1,
  contact2,
  noHelpline,
  nonData1,
  nonData2,
  withTaskId,
  withTaskIdAndTranscript,
  workerSid,
} from './mocks';
import './case-validation';
import * as caseApi from '../src/case/caseService';
import * as caseDb from '../src/case/case-data-access';
import * as contactApi from '../src/contact/contactService';
import * as contactDb from '../src/contact/contact-data-access';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as contactJobDataAccess from '../src/contact-job/contact-job-data-access';
import { chatChannels } from '../src/contact/channelTypes';
import { selectSingleContactByTaskId } from '../src/contact/sql/contact-get-sql';
import { ruleFileWithOneActionOverride } from './permissions-overrides';
import * as csamReportApi from '../src/csam-report/csam-report';
import * as referralDB from '../src/referral/referral-data-access';
import * as conversationMediaDB from '../src/conversation-media/conversation-media-data-access';
import { getRequest, getServer, headers, setRules, useOpenRules } from './server';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import * as profilesDB from '../src/profile/profile-data-access';

import { ContactJobType, isErr } from '@tech-matters/types';
import {
  cleanupCases,
  cleanupContacts,
  cleanupContactsJobs,
  cleanupCsamReports,
  cleanupReferrals,
  deleteContactById,
  deleteJobsByContactId,
} from './contact/db-cleanup';
import { selectJobsByContactId } from './contact/db-validations';

useOpenRules();
const server = getServer();
const request = getRequest(server);

/**
 *
 * @param {(() => Promise<any>)[]} ps
 * @returns
 */
const resolveSequentially = ps =>
  ps.reduce((p, v) => p.then(a => v().then(r => a.concat([r]))), Promise.resolve([]));

// eslint-disable-next-line @typescript-eslint/no-shadow
const getContactByTaskId = (taskId: string, accountSid: string) =>
  db.oneOrNone(selectSingleContactByTaskId('Contacts'), { accountSid, taskId });

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteContactJobById = (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
      DELETE FROM "ContactJobs"
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
  `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteCsamReportById = (id: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "CSAMReports"
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteCsamReportsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "CSAMReports"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteReferralsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "Referrals"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteConversationMediaByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "ConversationMedias"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteProfileById = (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
        DELETE FROM "Profiles"
        WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
    `),
  );

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteIdentifierById = (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
        DELETE FROM "Identifiers"
        WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
    `),
  );

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCsamReports();
  await cleanupReferrals();
  await cleanupContactsJobs();
  await cleanupContacts();
  await cleanupCases();
});

afterAll(async () => {
  await cleanupCsamReports();
  await cleanupReferrals();
  await cleanupContactsJobs();
  await cleanupContacts();
  await cleanupCases();
  await mockingProxy.stop();
  server.close();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('/contacts route', () => {
  const route = `/v0/accounts/${accountSid}/contacts`;
  const hourAgo = subHours(new Date(), 1);

  // First test post so database wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    type CreateContactTestCase = {
      contact: contactApi.CreateContactPayload;
      changeDescription?: string;
      expectedGetContact?: Partial<contactDb.Contact>;
      finalize?: boolean;
    };

    const createContactTestCases: CreateContactTestCase[] = [
      {
        contact: contact1,
        changeDescription: 'callType is Child calling about self',
      },
      {
        contact: {
          ...contact1,
          taskId: 'contact-1-task-sid-2',
          referrals: [
            {
              resourceId: 'TEST_RESOURCE',
              referredAt: hourAgo.toISOString(),
              resourceName: 'A test referred resource',
            },
            {
              resourceId: 'TEST_RESOURCE_1',
              referredAt: hourAgo.toISOString(),
              resourceName: 'Another test referred resource',
            },
          ],
        },
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
        changeDescription:
          'callType is Child calling about self (with variations in the form)',
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
          rawJson: {},
          twilioWorkerId: null,
          helpline: null,
          queueName: null,
          number: null,
          channel: null,
          conversationDuration: null,
          timeOfContact: null,
          taskId: 'empty-contact-tasksid',
          channelSid: null,
          serviceSid: null,
        },
        expectedGetContact: {
          rawJson: {} as ContactRawJson,
          twilioWorkerId: '',
          helpline: '',
          queueName: null,
          number: '',
          channel: '',
          conversationDuration: null,
          taskId: 'empty-contact-tasksid',
          channelSid: '',
          serviceSid: '',
        },
        changeDescription: 'missing fields (filled with defaults)',
      },
      {
        contact: contact1,
        changeDescription: 'callType is Child calling about self',
        finalize: false,
        expectedGetContact: {
          ...contact1,
          rawJson: {
            ...contact1.rawJson,
          } as ContactRawJson,
          finalizedAt: undefined,
        } as Partial<contactDb.Contact>,
      },
    ];

    each(createContactTestCases).test(
      'should return 200 when $changeDescription',
      async ({ contact, expectedGetContact = null, finalize = true }) => {
        // const updateSpy = jest.spyOn(CSAMReport, 'update');

        const expected = expectedGetContact || contact;

        const res = await request
          .post(`${route}?finalize=${finalize}`)
          .set(headers)
          .send(contact);

        expect(res.status).toBe(200);
        expect(res.body.referrals).toStrictEqual(contact.referrals || []);
        expect(res.body.rawJson.callType).toBe(contact.rawJson.callType);

        const createdContact = await contactDb.getById(accountSid, res.body.id);
        expect(createdContact).toBeDefined();

        expect(createdContact.rawJson).toMatchObject(expected.rawJson);
        expect(createdContact.timeOfContact).toParseAsDate();
        expect(createdContact.createdAt).toParseAsDate();
        expect(createdContact.updatedAt).toParseAsDate();
        expect(createdContact.twilioWorkerId).toBe(expected.twilioWorkerId);
        expect(createdContact.helpline).toBe(expected.helpline);
        expect(createdContact.queueName).toBe(expected.queueName || '');
        expect(createdContact.number).toBe(expected.number);
        expect(createdContact.channel).toBe(expected.channel);
        expect(createdContact.conversationDuration).toBe(expected.conversationDuration);
      },
    );

    test('Idempotence on create contact', async () => {
      const response = await request.post(route).set(headers).send(withTaskId);
      const subsequentResponse = await request.post(route).set(headers).send(withTaskId);

      // both should succeed
      expect(response.status).toBe(200);
      expect(subsequentResponse.status).toBe(200);

      // but should both return the same entity (i.e. the second call didn't create one)
      expect(subsequentResponse.body.id).toBe(response.body.id);
    });

    test('Concurrent idempotence on create contact', async () => {
      const responses = await Promise.all([
        request.post(route).set(headers).send(withTaskId),
        request.post(route).set(headers).send(withTaskId),
        request.post(route).set(headers).send(withTaskId),
        request.post(route).set(headers).send(withTaskId),
        request.post(route).set(headers).send(withTaskId),
        request.post(route).set(headers).send(withTaskId),
      ]);

      // all should succeed
      responses.forEach(response => expect(response.status).toBe(200));
      const expectedId = responses[0].body.id;
      // but should both return the same entity (i.e. only one call created one)

      responses.forEach(response => expect(response.body.id).toBe(expectedId));
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
      const maybeReport = await csamReportApi.getCSAMReport(
        notExistingCsamReport.id,
        accountSid,
      );
      expect(maybeReport).toBeNull();

      await deleteContactById(response.body.id, response.body.accountSid);
    });

    test('Connects to CSAM reports (valid csam reports ids)', async () => {
      // Create CSAM Report
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
          reportType: 'counsellor-generated',
        },
        accountSid,
      );

      // Create contact with above report
      const response = await request
        .post(route)
        .set(headers)
        .send({ ...contact1, csamReports: [newReport1, newReport2] });

      expect(response.status).toBe(200);

      const updatedReport1 = await csamReportApi.getCSAMReport(newReport1.id, accountSid);

      if (!updatedReport1) {
        throw new Error('updatedReport1 does not exists');
      }

      expect(updatedReport1.contactId).toBeDefined();
      expect(updatedReport1.contactId).toEqual(response.body.id);
      expect(updatedReport1.csamReportId).toBeDefined();

      const updatedReport2 = await csamReportApi.getCSAMReport(newReport2.id, accountSid);

      if (!updatedReport2) {
        throw new Error('updatedReport2 does not exists');
      }

      expect(updatedReport2.contactId).toBeDefined();
      expect(updatedReport2.contactId).toEqual(response.body.id);
      expect(updatedReport2.csamReportId).toEqual(csamReportId2);

      // Test the association
      expect(response.body.csamReports).toHaveLength(2);

      // Remove records to not interfere with following tests
      await deleteCsamReportsByContactId(response.body.id, response.body.accountSid);
      await deleteContactById(response.body.id, response.body.accountSid);
    });

    test(`If connecting csam report fails, the contact is not created either`, async () => {
      const csamReportId = 'csam-report-id';
      const newReport = await csamReportApi.createCSAMReport(
        {
          csamReportId: csamReportId,
          twilioWorkerId: workerSid,
          reportType: 'counsellor-generated',
        },
        accountSid,
      );

      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        csamReports: [newReport.id],
        channel: 'web',
        taskId: `${withTaskId.taskId}-web-csam-failure`,
      };

      const connectContactToCsamReportsSpy = jest
        .spyOn(csamReportApi, 'connectContactToCsamReports')
        .mockImplementationOnce(() => {
          throw new Error('Ups');
        });

      const res = await request.post(route).set(headers).send(contact);

      expect(res.status).toBe(500);

      const updatedReport = await csamReportApi.getCSAMReport(newReport.id, accountSid);
      expect(updatedReport?.contactId).toBeNull();

      const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

      expect(attemptedContact).toBeNull();

      await deleteCsamReportById(newReport.id, newReport.accountSid);
      connectContactToCsamReportsSpy.mockRestore();
    });

    test('Connects to referrals', async () => {
      const referral1 = {
        resourceId: 'TEST_RESOURCE',
        referredAt: new Date().toISOString(),
        resourceName: 'A test referred resource',
      };

      const referral2 = {
        resourceId: 'TEST_RESOURCE_2',
        referredAt: new Date().toISOString(),
        resourceName: 'Another test referred resource',
      };

      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        referrals: [referral1, referral2],
        channel: 'web',
        taskId: `${withTaskId.taskId}-web-referral`,
      };

      // Create contact with referrals
      const response = await request.post(route).set(headers).send(contact);

      expect(response.status).toBe(200);

      const createdReferrals = await db.task(t =>
        t.many(`
          SELECT * FROM "Referrals" WHERE "contactId" = ${response.body.id}
      `),
      );

      if (!createdReferrals || !createdReferrals.length) {
        throw new Error('createdReferrals is empty');
      }

      createdReferrals.forEach(r => {
        expect(r.contactId).toBeDefined();
        expect(r.contactId).toEqual(response.body.id);
      });

      // Test the association
      expect(response.body.referrals).toHaveLength(2);

      // Remove records to not interfere with following tests
      await deleteReferralsByContactId(response.body.id, response.body.accountSid);
      await deleteContactById(response.body.id, response.body.accountSid);
    });

    test(`If creating referral fails, the contact is not created either`, async () => {
      const referral = {
        resourceId: 'TEST_RESOURCE',
        referredAt: new Date().toISOString(),
        resourceName: 'A test referred resource',
      };

      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        referrals: [referral],
        channel: 'web',
        taskId: `${withTaskId.taskId}-web-referral-failure`,
      };

      const createReferralSpy = jest
        .spyOn(referralDB, 'createReferralRecord')
        .mockImplementationOnce(() => {
          throw new Error('Ups');
        });

      const res = await request.post(route).set(headers).send(contact);

      expect(createReferralSpy).toHaveBeenCalled();
      expect(res.status).toBe(500);

      const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

      expect(attemptedContact).toBeNull();
    });

    test('Connects to conversation media', async () => {
      const cm1: NewConversationMedia = {
        storeType: 'S3',
        storeTypeSpecificData: {
          type: S3ContactMediaType.TRANSCRIPT,
        },
      };

      const cm2: NewConversationMedia = {
        storeType: 'twilio',
        storeTypeSpecificData: {
          reservationSid: 'reservationSid',
        },
      };

      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        conversationMedia: [cm1, cm2],
        channel: 'web',
        taskId: `${withTaskId.taskId}-web-conversation-media`,
      };

      // Create contact with conversation media
      const response = await request.post(route).set(headers).send(contact);

      expect(response.status).toBe(200);

      const createdConversationMedia = await db.task(t =>
        t.many(`
          SELECT * FROM "ConversationMedias" WHERE "contactId" = ${response.body.id}
      `),
      );

      if (!createdConversationMedia || !createdConversationMedia.length) {
        throw new Error('createdConversationMedia is empty');
      }

      createdConversationMedia.forEach(r => {
        expect(r.contactId).toBeDefined();
        expect(r.contactId).toEqual(response.body.id);
      });

      // Test the association
      expect((response.body as contactDb.Contact).conversationMedia).toHaveLength(2);

      // Remove records to not interfere with following tests
      await deleteJobsByContactId(response.body.id, response.body.accountSid);
      await deleteConversationMediaByContactId(
        response.body.id,
        response.body.accountSid,
      );
      await deleteContactById(response.body.id, response.body.accountSid);
    });

    test(`If creating convfersation media fails, the contact is not created either`, async () => {
      const cm1: NewConversationMedia = {
        storeType: 'S3',
        storeTypeSpecificData: {
          type: S3ContactMediaType.TRANSCRIPT,
        },
      };

      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        conversationMedia: [cm1],
        channel: 'web',
        taskId: `${withTaskId.taskId}-web-conversation-media`,
      };

      const createConversationMediaSpy = jest
        .spyOn(conversationMediaDB, 'create')
        .mockImplementationOnce(() => {
          throw new Error('Ups');
        });

      const res = await request.post(route).set(headers).send(contact);

      expect(createConversationMediaSpy).toHaveBeenCalled();
      expect(res.status).toBe(500);

      const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

      expect(attemptedContact).toBeNull();
    });

    test(`If retrieving identifier and profile, the contact is not created either`, async () => {
      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        channel: 'web',
        taskId: `${withTaskId.taskId}-identifier`,
        number: 'identifier',
      };

      jest
        .spyOn(profilesDB, 'getIdentifierWithProfiles')
        .mockImplementationOnce(() => async () => {
          throw new Error('Ups');
        });

      const res = await request.post(route).set(headers).send(contact);

      expect(res.status).toBe(500);

      const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

      expect(attemptedContact).toBeNull();
    });

    test(`If identifier and profile exist, the contact is created using them`, async () => {
      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        channel: 'web',
        taskId: `${withTaskId.taskId}-identifier`,
        number: 'identifier1234',
      };

      const profileResult = await profilesDB.createIdentifierAndProfile()(accountSid, {
        identifier: contact.number,
      });

      if (isErr(profileResult)) {
        expect(false).toBeTruthy();
        return;
      }

      console.log('profileResult', profileResult);

      const identifierId = profileResult.data.id;
      const profileId = profileResult.data.profiles[0].id;

      const createIdentifierAndProfileSpy = jest.spyOn(
        profilesDB,
        'createIdentifierAndProfile',
      );

      // Create contact with conversation media
      const response = await request.post(route).set(headers).send(contact);

      expect(response.status).toBe(200);
      expect(createIdentifierAndProfileSpy).not.toHaveBeenCalled();
      expect(response.body.profileId).toBe(profileId);
      expect(response.body.identifierId).toBe(identifierId);

      // Remove records to not interfere with following tests
      await deleteJobsByContactId(response.body.id, response.body.accountSid);
      await deleteContactById(response.body.id, response.body.accountSid);
      await deleteProfileById(profileId, response.body.accountSid);
      await deleteIdentifierById(identifierId, response.body.accountSid);
    });

    test(`If identifier and profile don't exist, they are created and the contact is created using them`, async () => {
      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        channel: 'web',
        taskId: `${withTaskId.taskId}-identifier`,
        number: 'identifier',
      };

      const createIdentifierAndProfileSpy = jest.spyOn(
        profilesDB,
        'createIdentifierAndProfile',
      );

      // Create contact with conversation media
      const response = await request.post(route).set(headers).send(contact);

      expect(response.status).toBe(200);
      expect(createIdentifierAndProfileSpy).toHaveBeenCalled();
      expect(response.body.profileId).toBeDefined();
      expect(response.body.identifierId).toBeDefined();

      // Remove records to not interfere with following tests
      await deleteJobsByContactId(response.body.id, response.body.accountSid);
      await deleteContactById(response.body.id, response.body.accountSid);
      await deleteProfileById(response.body.profileId, response.body.accountSid);
      await deleteIdentifierById(response.body.identifierId, response.body.accountSid);
    });

    test(`If number is not present in the contact payload, no identifier nor profile is created and they are null in the contact record`, async () => {
      const contact = {
        ...withTaskId,
        rawJson: {
          ...withTaskId.rawJson,
        },
        channel: 'web',
        taskId: `${withTaskId.taskId}-identifier`,
        number: undefined,
      };

      const getIdentifierWithProfilesSpy = jest.spyOn(
        profilesDB,
        'getIdentifierWithProfiles',
      );
      const createIdentifierAndProfileSpy = jest.spyOn(
        profilesDB,
        'createIdentifierAndProfile',
      );

      // Create contact with conversation media
      const response = await request.post(route).set(headers).send(contact);

      expect(response.status).toBe(200);
      expect(getIdentifierWithProfilesSpy).not.toHaveBeenCalled();
      expect(createIdentifierAndProfileSpy).not.toHaveBeenCalled();
      expect(response.body.profileId).toBeNull();
      expect(response.body.identifierId).toBeNull();

      // Remove records to not interfere with following tests
      await deleteJobsByContactId(response.body.id, response.body.accountSid);
      await deleteContactById(response.body.id, response.body.accountSid);
    });

    each(
      chatChannels.map(channel => ({
        channel,
        contact: {
          ...withTaskId,
          rawJson: {
            ...withTaskId.rawJson,
            conversationMedia: [
              {
                store: 'S3',
                type: S3ContactMediaType.TRANSCRIPT,
              },
            ],
          },
          channel,
          taskId: `${withTaskId.taskId}-${channel}`,
        },
      })),
    ).test(
      `contacts with channel type $channel should create ${ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job`,
      async ({ contact }) => {
        const res = await request.post(route).set(headers).send(contact);

        expect(res.status).toBe(200);

        const createdContact = await contactDb.getById(accountSid, res.body.id);
        const jobs = await selectJobsByContactId(
          createdContact.id,
          createdContact.accountSid,
        );

        const retrieveContactTranscriptJobs = jobs.filter(
          j => j.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        );
        expect(retrieveContactTranscriptJobs).toHaveLength(1);

        // Test that idempotence applies to jobs too
        const res2 = await request.post(route).set(headers).send(contact);

        expect(res2.status).toBe(200);
        const jobs2 = await selectJobsByContactId(res.body.id, res.body.accountSid);

        const retrieveContactTranscriptJobs2 = jobs2.filter(
          j => j.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        );
        expect(retrieveContactTranscriptJobs2).toHaveLength(1);

        const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

        expect(attemptedContact).not.toBeNull();

        await Promise.all(
          retrieveContactTranscriptJobs.map(j =>
            deleteContactJobById(j.id, j.accountSid),
          ),
        );
        await deleteContactById(res.body.id, res.body.accountSid);
      },
    );

    each(
      chatChannels.map(channel => ({
        channel,
        contact: {
          ...withTaskId,
          rawJson: {
            ...withTaskId.rawJson,
            conversationMedia: [
              {
                store: 'S3',
                type: S3ContactMediaType.TRANSCRIPT,
              },
            ],
          },
          channel,
          taskId: `${withTaskId.taskId}-${channel}`,
        },
      })),
    ).test(
      `if contact with channel type $channel is not created, neither is ${ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job`,
      async ({ contact }) => {
        const createContactSpy = jest
          .spyOn(contactDb, 'create')
          .mockImplementation(() => {
            throw new Error('Oops');
          });
        const createContactJobSpy = jest.spyOn(contactJobDataAccess, 'createContactJob');

        try {
          const res = await request.post(route).set(headers).send(contact);

          expect(res.status).toBe(500);

          expect(createContactJobSpy).not.toHaveBeenCalled();

          const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

          expect(attemptedContact).toBeNull();
        } finally {
          createContactSpy.mockRestore();
          createContactJobSpy.mockRestore();
        }
      },
    );

    each(
      chatChannels.map(channel => ({
        channel,
        contact: {
          ...withTaskId,
          rawJson: {
            ...withTaskId.rawJson,
            conversationMedia: [
              {
                store: 'S3',
                type: S3ContactMediaType.TRANSCRIPT,
              },
            ],
          },
          channel,
          taskId: `${withTaskId.taskId}-${channel}`,
        },
      })),
    ).test(
      `if ${ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job creation fails with channel type $channel, the contact is not created either, and csams are not linked`,
      async ({ contact }) => {
        const csamReportId = 'csam-report-id';
        const newReport = await csamReportApi.createCSAMReport(
          {
            csamReportId: csamReportId,
            twilioWorkerId: workerSid,
            reportType: 'counsellor-generated',
          },
          accountSid,
        );

        const createContactJobSpy = jest
          .spyOn(contactJobDataAccess, 'createContactJob')
          .mockImplementationOnce(() => {
            throw new Error('Ups');
          });

        const contactWithCsam = { ...contact, csamReports: [newReport] };
        const res = await request.post(route).set(headers).send(contactWithCsam);

        expect(res.status).toBe(500);

        const updatedReport = await csamReportApi.getCSAMReport(newReport.id, accountSid);
        expect(updatedReport?.contactId).toBeNull();

        const attemptedContact = await getContactByTaskId(contact.taskId, accountSid);

        expect(attemptedContact).toBeNull();

        await deleteCsamReportById(updatedReport!.id, updatedReport!.accountSid);
        createContactJobSpy.mockRestore();
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
        true,
        withTaskIdAndTranscript,
        { user: twilioUser(workerSid, []), can: () => true },
      );

      if (!expectTranscripts) {
        setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
      } else {
        useOpenRules();
      }

      const res = await request.post(route).set(headers).send(withTaskIdAndTranscript);

      if (expectTranscripts) {
        expect(
          (<contactApi.Contact>res.body).conversationMedia?.some(isS3StoredTranscript),
        ).toBeTruthy();
        expect(
          (<contactApi.Contact>res.body).rawJson?.conversationMedia?.some(
            cm => cm.store === 'S3',
          ),
        ).toBeTruthy();
      } else {
        expect(
          (<contactApi.Contact>res.body).conversationMedia?.some(isS3StoredTranscript),
        ).toBeFalsy();
        expect(
          (<contactApi.Contact>res.body).rawJson?.conversationMedia?.some(
            cm => cm.store === 'S3',
          ),
        ).toBeFalsy();
      }

      await deleteJobsByContactId(createdContact.id, createdContact.accountSid);
      await deleteContactById(createdContact.id, createdContact.accountSid);
      useOpenRules();
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
      let csamReports = new Array<csamReportApi.CSAMReport>();
      const [currentUTCDateString] = new Date().toISOString().split('T');

      const startTestsTimeStamp = parseISO(`${currentUTCDateString}T06:00:00.000Z`);

      beforeAll(async () => {
        // Clean what's been created so far
        await cleanupCsamReports();
        await cleanupReferrals();
        await cleanupContactsJobs();
        await cleanupContacts();
        await cleanupCases();

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

        const invalidContact = {};

        const withCSAMReports = {
          ...noHelpline,
          taskId: 'withCSAMReports-tasksid-2',
          queueName: 'withCSAMReports',
          number: '123412341234',
          csamReports: [newReport1, newReport2],
        };
        const responses = await resolveSequentially(
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
            invalidContact,
            withCSAMReports,
            oneWeekBefore,
          ].map(c => () => request.post(route).set(headers).send(c)),
        );

        createdContacts = responses.map(r => r.body);
        const withCSAMReportsId = createdContacts.find(
          c => c.queueName === 'withCSAMReports',
        )!.id;
        // Retrieve the csam reports that should be connected to withCSAMReports
        const updatedCsamReports = await csamReportApi.getCsamReportsByContactId(
          withCSAMReportsId,
          accountSid,
        );
        expect(updatedCsamReports).toHaveLength(2);
        csamReports = updatedCsamReports;
      });

      afterAll(async () => {
        await Promise.all(csamReports.map(c => deleteCsamReportById(c.id, c.accountSid)));
        await Promise.all(
          createdContacts
            .filter(c => c.id)
            .map(c => deleteContactById(c.id, c.accountSid)),
        );
      });

      const expectLegacyRawJsonToEqualRawJson = (
        actual: contactApi.WithLegacyCategories<contactDb.Contact>['rawJson'],
        expected: contactApi.WithLegacyCategories<contactDb.Contact>['rawJson'],
        legacyCategories: Record<string, Record<string, boolean>> = {},
      ) => {
        expect(actual).toStrictEqual({
          ...expected,
          caseInformation: {
            ...expected.caseInformation,
            categories: legacyCategories,
          },
        });
      };

      each([
        {
          body: { firstName: 'jh', lastName: 'he' },
          changeDescription: 'multiple input search',
          expectCallback: response => {
            // Name based filters remove non data contacts regardless of setting?
            expect(response.status).toBe(200);
            const { contacts, count } = response.body;

            const [c2, c1] = contacts; // result is sorted DESC
            expectLegacyRawJsonToEqualRawJson(c1.details, contact1.rawJson);
            expectLegacyRawJsonToEqualRawJson(c2.details, contact2.rawJson);

            // Test the association
            expect(c1.csamReports).toHaveLength(0);
            expect(c2.csamReports).toHaveLength(0);
            // Test the association
            expect(c1.overview.taskId).toBe('contact1-tasksid-2');
            expect(c2.overview.taskId).toBe('contact2-tasksid-2');
            expect(count).toBe(2);
            expect(contacts.length).toBe(2);
          },
        },
        {
          body: { firstName: 'jh', lastName: 'he', onlyDataContacts: true },
          changeDescription: 'multiple input search (data contacts only)',
          expectCallback: response => {
            expect(response.status).toBe(200);
            const { contacts, count } = response.body;

            const [c2, c1] = contacts; // result is sorted DESC
            expectLegacyRawJsonToEqualRawJson(c1.details, contact1.rawJson);
            expectLegacyRawJsonToEqualRawJson(c2.details, contact2.rawJson);

            // Test the association
            expect(c1.csamReports).toHaveLength(0);
            expect(c2.csamReports).toHaveLength(0);
            // Test the association
            expect(c1.overview.taskId).toBe('contact1-tasksid-2');
            expect(c2.overview.taskId).toBe('contact2-tasksid-2');
            expect(count).toBe(2);
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
            expectLegacyRawJsonToEqualRawJson(a.details, another1.rawJson);
          },
        },
        {
          changeDescription: 'multiple input search without name search',
          body: { counselor: workerSid }, // should match contact1 & broken1 & another1 & noHelpline
          expectCallback: response => {
            const { contacts } = response.body;

            expect(response.status).toBe(200);
            // invalidContact will return null from the search endpoint, exclude it here
            expect(contacts.length).toBe(createdContacts.length - 1);
            const createdContactsByTimeOfContact = createdContacts.sort(
              compareTimeOfContactDesc,
            );
            createdContactsByTimeOfContact.forEach(c => {
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
            'multiple input search without name search excluding non data contacts',
          body: { counselor: workerSid, onlyDataContacts: true }, // should match contact1 & broken1 & another1 & noHelpline
          expectCallback: response => {
            const { contacts } = response.body;

            expect(response.status).toBe(200);
            // invalidContact will return null, and nonData1, nonData2, broken1 and broken2 are not data contact types
            expect(contacts.length).toBe(createdContacts.length - 5);
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
                const searchContact = contacts.find(
                  results => results.contactId === c.id,
                );
                if (searchContact) {
                  // Check that all contacts contains the appropriate info
                  expect(c.rawJson).toMatchObject(searchContact.details);
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
              const { count, contacts } = response.body;
              expect(response.status).toBe(200);
              expect(count).toBe(1);
              expectLegacyRawJsonToEqualRawJson(contacts[0].details, another2.rawJson);
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
              const { count, contacts } = response.body;
              expect(response.status).toBe(200);
              expect(count).toBe(1);
              expectLegacyRawJsonToEqualRawJson(contacts[0].details, another2.rawJson);
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
            const { contacts } = response.body;

            expect(contacts).toHaveLength(1);
            expect(contacts[0].details).toMatchObject(withTaskId.rawJson);
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
            expect(contacts[0].details).toMatchObject(noHelpline.rawJson);
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
            expect(contacts[0].details).toMatchObject(noHelpline.rawJson);
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
            expect(contacts).toHaveLength(createdContacts.length - 2);
            const createdContactsByTimeOfContact = createdContacts.sort(
              compareTimeOfContactDesc,
            );
            createdContactsByTimeOfContact.forEach(c => {
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
            expect(contacts).toHaveLength(createdContacts.length - 3);
            const createdContactsByTimeOfContact = createdContacts.sort(
              compareTimeOfContactDesc,
            );
            createdContactsByTimeOfContact.forEach(c => {
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
            const withCSAMReports = createdContacts.find(
              c => c.queueName === 'withCSAMReports',
            );

            if (!withCSAMReports) {
              throw new Error('withCSAMReports is undefined');
            }

            expect(
              contacts.find(c => withCSAMReports.id.toString() === c.contactId),
            ).toBeDefined();
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

            const [c2, c1] = contacts; // result is sorted DESC
            expectLegacyRawJsonToEqualRawJson(c1.details, contact1.rawJson);
            expectLegacyRawJsonToEqualRawJson(c2.details, contact2.rawJson);

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
          true,
          withTaskIdAndTranscript,
          { user: twilioUser(workerSid, []), can: () => true },
        );

        if (!expectTranscripts) {
          setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
        } else {
          useOpenRules();
        }

        const res = await request
          .post(`${route}/search`)
          .set(headers)
          .send({
            dateFrom: subSeconds(createdContact.createdAt, 1).toISOString(),
            dateTo: addSeconds(createdContact.createdAt, 1).toISOString(),
            firstName: 'withTaskIdAndTranscript',
          });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);

        if (expectTranscripts) {
          expect(
            (<contactApi.SearchContact>res.body.contacts[0]).conversationMedia?.some(
              isS3StoredTranscript,
            ),
          ).toBeTruthy();
          expect(
            (<contactApi.SearchContact>(
              res.body.contacts[0]
            )).details.conversationMedia?.some(cm => cm.store === 'S3'),
          ).toBeTruthy();
        } else {
          expect(
            (<contactApi.SearchContact>res.body.contacts[0]).conversationMedia?.some(
              isS3StoredTranscript,
            ),
          ).toBeFalsy();
          expect(
            (<contactApi.SearchContact>(
              res.body.contacts[0]
            )).details.conversationMedia?.some(cm => cm.store === 'S3'),
          ).toBeFalsy();
        }

        await deleteJobsByContactId(createdContact.id, createdContact.accountSid);
        await deleteContactById(createdContact.id, createdContact.accountSid);
        useOpenRules();
      });

      test('CSAM reports are filtered if not acknowledged', async () => {
        // Create CSAM Report
        const csamReportId1 = 'csam-report-id-1';
        const csamReportId2 = 'csam-report-id-2';
        const csamReportId3 = 'csam-report-id-2';

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
            reportType: 'counsellor-generated',
          },
          accountSid,
        );

        // This one should not be retrieved
        const newReport3 = await csamReportApi.createCSAMReport(
          {
            csamReportId: csamReportId3,
            twilioWorkerId: workerSid,
            reportType: 'self-generated',
          },
          accountSid,
        );

        const contactToCreate = {
          ...withTaskId,
          taskId: 'Test CSAM filter',
          csamReports: [newReport1, newReport2, newReport3],
        };
        // Very specific first name
        contactToCreate.rawJson.childInformation.firstName = 'Test CSAM filter';
        const createdContact = await contactApi.createContact(
          accountSid,
          workerSid,
          true,
          contactToCreate,
          { user: twilioUser(workerSid, []), can: () => true },
        );

        await csamReportApi.acknowledgeCsamReport(newReport1.id, accountSid);

        const res = await request.post(`${route}/search`).set(headers).send({
          firstName: 'Test CSAM filter',
        });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);

        expect((<contactApi.SearchContact>res.body.contacts[0]).csamReports).toHaveLength(
          2,
        );
        expect(
          (<contactApi.SearchContact>res.body.contacts[0]).csamReports.find(
            r => r.id === newReport3.id,
          ),
        ).toBeFalsy();

        // // Remove records to not interfere with following tests
        await deleteCsamReportsByContactId(createdContact.id, createdContact.accountSid);
        await deleteContactById(createdContact.id, createdContact.accountSid);
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
      createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        <any>contact1,
        {
          user: twilioUser(workerSid, []),
          can: () => true,
        },
      );
      createdCase = await caseApi.createCase(case1, accountSid, workerSid);
      anotherCreatedCase = await caseApi.createCase(case2, accountSid, workerSid);
      const contactToBeDeleted = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        <any>contact2,
        { user: twilioUser(workerSid, []), can: () => true },
      );
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
            await db.task(t =>
              t.any(`SELECT COUNT(*) FROM "Audits" WHERE "tableName" = 'Cases'`),
            )
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

        // Connecting contacts to cases updates contacts, but also touches the updatedat / updatedby fields on the case
        expect(casesAudits).toHaveLength(casesAuditPreviousCount + 1);
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

        expect(casesAuditAfterCount).toBe(casesAuditPreviousCount + 1);
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

        expect(casesAuditAfterCount).toBe(casesAuditPreviousCount + 1);
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
    describe('DELETE', () => {
      const subRoute = contactId => `${route}/${contactId}/connectToCase`;
      test('should return 401', async () => {
        const response = await request.delete(subRoute(existingContactId));

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      test('should return 200', async () => {
        const response = await request.delete(subRoute(existingContactId)).set(headers);

        const contact = await contactDb.getById(accountSid, response.body.id);

        expect(response.status).toBe(200);
        expect(response.body.caseId).toBe(null);
        expect(contact.caseId).toBe(null);
      });

      test('should return 404', async () => {
        const response = await request
          .delete(subRoute(nonExistingContactId))
          .set(headers);

        expect(response.status).toBe(404);
      });
    });
  });
});
