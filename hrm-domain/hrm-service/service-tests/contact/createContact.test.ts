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

import { db } from '@tech-matters/hrm-core/connection-pool';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import {
  accountSid,
  another1,
  another2,
  broken1,
  broken2,
  contact1,
  contact2,
  noHelpline,
  withTaskId,
  workerSid,
} from '../mocks';
import '../case/caseValidation';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { selectSingleContactByTaskId } from '@tech-matters/hrm-core/contact/sql/contact-get-sql';
import {
  basicHeaders,
  getInternalServer,
  getRequest,
  getServer,
  headers,
  useOpenRules,
} from '../server';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import * as profilesDB from '@tech-matters/hrm-core/profile/profileDataAccess';
import * as profilesService from '@tech-matters/hrm-core/profile/profileService';

import { isErr, HrmAccountId } from '@tech-matters/types';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { clearAllTables } from '../dbCleanup';
import { setupTestQueues } from '../sqs';

const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);

// eslint-disable-next-line @typescript-eslint/no-shadow
const getContactByTaskId = (taskId: string, accountSid: HrmAccountId) =>
  db.oneOrNone(selectSingleContactByTaskId('Contacts'), { accountSid, taskId });

beforeAll(async () => {
  await clearAllTables();
  await mockingProxy.start();
  const mockttp = await mockingProxy.mockttpServer();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await mockSsmParameters(mockttp, [
    { pathPattern: /.*/, valueGenerator: () => SEARCH_INDEX_SQS_QUEUE_NAME },
  ]);
});

afterAll(async () => {
  await mockingProxy.stop();
  server.close();
  internalServer.close();
});

afterEach(clearAllTables);

setupTestQueues([SEARCH_INDEX_SQS_QUEUE_NAME]);

each([
  {
    testRequest: request,
    route: `/v0/accounts/${accountSid}/contacts`,
    testHeaders: headers,
    description: 'public route',
  },
  {
    testRequest: internalRequest,
    route: `/internal/v0/accounts/${accountSid}/contacts`,
    testHeaders: basicHeaders,
    description: 'internal route',
  },
]).describe('POST /contacts $description', ({ testRequest, route, testHeaders }) => {
  test('should return 401', async () => {
    const response = await testRequest.post(route).send(contact1);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization failed');
  });

  type CreateContactTestCase = {
    contact: NewContactRecord;
    changeDescription?: string;
    expectedGetContact?: Partial<contactDb.Contact>;
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
        rawJson: {} as ContactRawJson,
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
        twilioWorkerId: null,
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
      expectedGetContact: {
        ...contact1,
        finalizedAt: undefined,
      } as Partial<contactDb.Contact>,
    },
  ];

  each(createContactTestCases).test(
    'should return 200 when $changeDescription',
    async ({ contact, expectedGetContact = null, finalize = true }) => {
      // const updateSpy = jest.spyOn(CSAMReport, 'update');

      const expected = expectedGetContact || contact;

      const res = await testRequest
        .post(`${route}?finalize=${finalize}`)
        .set(testHeaders)
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
      expect(createdContact.finalizedAt).toBeFalsy();
    },
  );

  test('Idempotence on create contact', async () => {
    const response = await testRequest.post(route).set(testHeaders).send(withTaskId);
    const subsequentResponse = await testRequest
      .post(route)
      .set(testHeaders)
      .send(withTaskId);

    // both should succeed
    expect(response.status).toBe(200);
    expect(subsequentResponse.status).toBe(200);

    // but should both return the same entity (i.e. the second call didn't create one)
    expect(subsequentResponse.body.id).toBe(response.body.id);
  });

  test('Concurrent idempotence on create contact', async () => {
    const responses = await Promise.all([
      testRequest.post(route).set(testHeaders).send(withTaskId),
      testRequest.post(route).set(testHeaders).send(withTaskId),
      testRequest.post(route).set(testHeaders).send(withTaskId),
      testRequest.post(route).set(testHeaders).send(withTaskId),
      testRequest.post(route).set(testHeaders).send(withTaskId),
      testRequest.post(route).set(testHeaders).send(withTaskId),
    ]);

    // all should succeed
    responses.forEach(response => expect(response.status).toBe(200));
    const expectedId = responses[0].body.id;
    // but should both return the same entity (i.e. only one call created one)

    responses.forEach(response => expect(response.body.id).toBe(expectedId));
  });

  test(`If retrieving identifier and profile fails, the contact is not created either`, async () => {
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

    const res = await testRequest.post(route).set(testHeaders).send(contact);

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

    const profileResult = await profilesService.createIdentifierAndProfile()(
      accountSid,
      {
        identifier: { identifier: contact.number },
        profile: { name: null },
      },
      { user: newTwilioUser(accountSid, workerSid, []) },
    );

    if (isErr(profileResult)) {
      expect(false).toBeTruthy();
      return;
    }

    console.log('profileResult', profileResult);

    const identifierId = profileResult.data.id;
    const profileId = profileResult.data.profiles[0].id;

    // Create contact with conversation media
    const response = await testRequest.post(route).set(testHeaders).send(contact);

    expect(response.status).toBe(200);
    expect(response.body.profileId).toBe(profileId);
    expect(response.body.identifierId).toBe(identifierId);
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
      profilesService,
      'createIdentifierAndProfile',
    );

    // Create contact with conversation media
    const response = await testRequest.post(route).set(testHeaders).send(contact);

    expect(response.status).toBe(200);
    expect(createIdentifierAndProfileSpy).toHaveBeenCalled();
    expect(response.body.profileId).toBeDefined();
    expect(response.body.identifierId).toBeDefined();
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

    const response = await testRequest.post(route).set(testHeaders).send(contact);

    expect(response.status).toBe(200);
    expect(response.body.profileId).toBeNull();
    expect(response.body.identifierId).toBeNull();
  });
});
