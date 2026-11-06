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
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import { create as createPostSurvey } from '@tech-matters/hrm-core/post-survey/postSurveyDataAccess';
import '../case/caseValidation';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../mocks';
import { headers, setRules } from '../server';
import { ruleFileActionOverride } from '../permissions-overrides';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import { setupServiceTests } from '../setupServiceTest';

const route = `/v0/accounts/${accountSid}/contacts`;

let createdContact: contactDb.Contact;

const { request } = setupServiceTests();

beforeEach(async () => {
  createdContact = await contactApi.createContact(
    accountSid,
    workerSid,
    {
      ...contact1,
      rawJson: <ContactRawJson>{},
    },
    ALWAYS_CAN,
    true,
  );
});

describe('/contacts/:contactId route', () => {
  const subRoute = id => `${route}/${id}`;
  describe('GET', () => {
    test('should return 401 if user is not authenticated', async () => {
      const response = await request.get(subRoute(createdContact.id));
      expect(response.status).toBe(401);
    });

    test("should return 404 if contact doesn't exist", async () => {
      const response = await request.get(subRoute(1234567890)).set(headers);
      expect(response.status).toBe(404);
    });

    test('Should find correct contact by task and return with a 200 code if it exists and the user is authenticated', async () => {
      const response = await request.get(subRoute(createdContact.id)).set(headers);

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

    describe('postSurveys', () => {
      each([
        { channel: 'voice', canViewPostSurvey: true },
        { channel: 'web', canViewPostSurvey: true },
        { channel: 'voice', canViewPostSurvey: false },
      ]).test(
        'channel $channel, viewPostSurvey permitted: $canViewPostSurvey',
        async ({ channel, canViewPostSurvey }) => {
          if (!canViewPostSurvey) {
            setRules(ruleFileActionOverride('viewPostSurvey', false));
          }
          const taskId = `post-survey-contact-${channel}-${canViewPostSurvey}`;
          const contact = await contactApi.createContact(
            accountSid,
            workerSid,
            { ...contact1, channel, taskId },
            ALWAYS_CAN,
            true,
          );
          const postSurvey = await createPostSurvey(accountSid, {
            contactTaskId: taskId,
            taskId: `${taskId}-survey`,
            data: { comments: 'Some answer' },
          });

          const response = await request.get(subRoute(contact.id)).set(headers);

          expect(response.status).toBe(200);
          if (canViewPostSurvey) {
            expect(response.body.postSurveys).toStrictEqual([
              expect.objectContaining({
                contactTaskId: taskId,
                taskId: postSurvey.taskId,
                data: postSurvey.data,
              }),
            ]);
          } else {
            expect(response.body.postSurveys).toBeUndefined();
          }
        },
      );
    });
  });
});
