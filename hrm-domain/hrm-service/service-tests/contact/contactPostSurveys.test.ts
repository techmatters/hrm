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
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../mocks';
import { headers, setRules, useOpenRules } from '../server';
import { ruleFileActionOverride } from '../permissions-overrides';
import { setupServiceTests } from '../setupServiceTest';

const route = `/v0/accounts/${accountSid}/contacts`;

const { request } = setupServiceTests();

describe('GET /contacts/:contactId - postSurveys', () => {
  each([
    { channel: 'voice', canViewPostSurvey: true },
    { channel: 'web', canViewPostSurvey: true },
    { channel: 'voice', canViewPostSurvey: false },
  ]).test(
    'channel $channel, viewPostSurvey permitted: $canViewPostSurvey',
    async ({ channel, canViewPostSurvey }) => {
      useOpenRules();
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

      const response = await request.get(`${route}/${contact.id}`).set(headers);

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
