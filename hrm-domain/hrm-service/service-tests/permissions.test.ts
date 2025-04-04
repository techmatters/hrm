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
import { actionsMaps, rulesMap } from '@tech-matters/hrm-core/permissions/index';
import { withTaskId } from './mocks';
import { headers } from './server';
import {
  NewConversationMedia,
  S3ContactMediaType,
} from '@tech-matters/hrm-core/conversation-media/conversationMedia';
import * as contactDB from '@tech-matters/hrm-core/contact/contactDataAccess';
import * as conversationMediaDB from '@tech-matters/hrm-core/conversation-media/conversationMediaDataAccess';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { AccountSID } from '@tech-matters/types';
import { setupServiceTestsWithConfig } from './setupServiceTest';

const { request } = setupServiceTestsWithConfig({
  serverConfig: {
    permissions: undefined,
  },
});

describe('/permissions route', () => {
  describe('GET', () => {
    each([
      {
        headersConfig: {},
        accountSid: 'notConfigured',
        description: 'Should return status 401 (Authorization failed)',
        expectedStatus: 401,
      },
      {
        accountSid: 'notConfigured',
        description: 'Should return status 500 (permissions env var set to empty value)',
        expectedStatus: 500,
      },
      {
        accountSid: 'missingInEnvVars',
        description: 'Should return status 500 (permissions env var missing)',
        expectedStatus: 500,
      },
      {
        accountSid: 'notExistsInRulesMap',
        description:
          'Should return status 500 (permissions env var is set but no match found in rulesMap)',
        expectedStatus: 500,
      },
      ...Object.entries(rulesMap).map(([key, rules]) => ({
        accountSid: `AC${key}`,
        description: `Should return status 200 with ${key} permissions`,
        expectedStatus: 200,
        expectedPayload: rules,
      })),
    ]).test(
      '$description',
      async ({
        accountSid,
        headersConfig = headers,
        expectedStatus,
        expectedPayload = undefined,
      }) => {
        const response = await request
          .get(`/v0/accounts/${accountSid}/permissions`) // env vars for fake accountsSids set in setTestEnvVars.js
          .set(headersConfig);

        expect(response.status).toBe(expectedStatus);
        if (expectedStatus === 200) expect(response.body).toMatchObject(expectedPayload);
      },
    );
  });
});

describe('/permissions/:action route with contact objectType', () => {
  const accountSids: AccountSID[] = ['ACopen', 'ACclosed'];
  let createdContacts = {
    ACopen: null,
    ACclosed: null,
  };
  const bucket = 'bucket';
  const key = 'key';

  beforeEach(async () => {
    await Promise.all(
      accountSids.map(async accountSid => {
        const cm1: NewConversationMedia = {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
            location: { bucket, key },
          },
        };

        const cm2: NewConversationMedia = {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.RECORDING,
            location: { bucket, key },
          },
        };

        const contact: NewContactRecord = {
          ...withTaskId,
          channel: 'web',
          taskId: `${withTaskId.taskId}-${accountSid}`,
          timeOfContact: new Date().toISOString(),
          channelSid: 'channelSid',
          serviceSid: 'serviceSid',
        } as NewContactRecord;
        const { contact: createdContact } = (
          await contactDB.create()(accountSid, contact)
        ).unwrap();
        createdContacts[accountSid] = createdContact;

        await Promise.all(
          [cm1, cm2].map(async cm => {
            await conversationMediaDB.create()(accountSid, {
              ...cm,
              contactId: createdContact.id,
            });
          }),
        );
      }),
    );
  });

  each(
    accountSids
      .flatMap(accountSid => [
        {
          action: actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
          accountSid,
          shouldHavePermission: accountSid === 'ACopen',
        },
        {
          action: actionsMaps.contact.VIEW_RECORDING,
          accountSid,
          shouldHavePermission: accountSid === 'ACopen',
        },
      ])
      .flatMap(testCase => [
        { ...testCase, key: 'invalid', bucket, shouldBeValid: false },
        { ...testCase, key, bucket: 'invalid', shouldBeValid: false },
        { ...testCase, key, bucket, shouldBeValid: true },
      ])
      .map(testCase => ({
        ...testCase,
        expectedStatusCode:
          testCase.shouldHavePermission && testCase.shouldBeValid ? 200 : 403,
      })),
  ).test(
    'when action is $action, permissions validity is $shouldHavePermission, location validity is $shouldBeValid - then expect $expectedStatusCode',
    // eslint-disable-next-line @typescript-eslint/no-shadow
    async ({ action, accountSid, bucket, key, expectedStatusCode }) => {
      const contact = createdContacts[accountSid];
      const objectId = contact.id;
      const route = `/v0/accounts/${accountSid}/permissions/${action}?objectType=contact&objectId=${objectId}&bucket=${bucket}&key=${key}`;
      const res = await request.get(route).set(headers);

      expect(res.statusCode).toBe(expectedStatusCode);
    },
  );
});
