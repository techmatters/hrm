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

import * as contactApi from '../../src/contact/contactService';
import '../case/caseValidation';
import { ContactRawJson } from '../../src/contact/contactJson';
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../mocks';
import { getRequest, getServer, headers, useOpenRules } from '../server';
import * as contactDb from '../../src/contact/contactDataAccess';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import {
  cleanupCases,
  cleanupContacts,
  cleanupContactsJobs,
  cleanupCsamReports,
  cleanupReferrals,
} from './db-cleanup';

useOpenRules();
const server = getServer();
const request = getRequest(server);
const route = `/v0/accounts/${accountSid}/contacts`;

const cleanup = async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCsamReports();
  await cleanupReferrals();
  await cleanupContactsJobs();
  await cleanupContacts();
  await cleanupCases();
};

let createdContact: contactDb.Contact;

beforeEach(async () => {
  await cleanup();

  createdContact = await contactApi.createContact(
    accountSid,
    workerSid,
    {
      ...contact1,
      rawJson: <ContactRawJson>{},
    },
    ALWAYS_CAN,
  );
});

afterAll(cleanup);

describe('/contacts/byTaskSid/:contactId route', () => {
  const subRoute = taskSid => `${route}/byTaskSid/${taskSid}`;
  describe('GET', () => {
    test('should return 401 if user is not authenticated', async () => {
      const response = await request.get(subRoute(createdContact.id));
      expect(response.status).toBe(401);
    });

    test("should return 404 if contact doesn't exist", async () => {
      const response = await request.get(subRoute('not a task')).set(headers);
      expect(response.status).toBe(404);
    });

    test('Should find correct contact by task and return with a 200 code if it exists and the user is authenticated', async () => {
      const response = await request.get(subRoute(createdContact.taskId)).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...createdContact,
        createdAt: expect.toParseAsDate(),
        finalizedAt: expect.toParseAsDate(),
        updatedAt: expect.toParseAsDate(),
        timeOfContact: expect.toParseAsDate(),
        rawJson: {
          ...createdContact.rawJson,
        },
        conversationMedia: [],
      });
    });
  });
});
