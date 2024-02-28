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

import formatISO from 'date-fns/formatISO';
import subMinutes from 'date-fns/subMinutes';
import { randomBytes } from 'crypto';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';

import { TKConditionsSets, RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import { headers, getRequest, getServer, setRules, useOpenRules } from '../server';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import * as contactService from '@tech-matters/hrm-core/contact/contactService';
import { TargetKind } from '@tech-matters/hrm-core/permissions/actions';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { AccountSID } from '@tech-matters/types';
import { ALWAYS_CAN } from '../mocks';
import { clearAllTables } from '../dbCleanup';
import each from 'jest-each';

const server = getServer();
const request = getRequest(server);

const accountSid: AccountSID = `AC${randomBytes(16).toString('hex')}`;
const userTwilioWorkerId = `WK${randomBytes(16).toString('hex')}`;
const anotherUserTwilioWorkerId = `WK${randomBytes(16).toString('hex')}`;
const rawJson: ContactRawJson = {
  callType: 'Silent',
  categories: {},
  caseInformation: {
    actionTaken: '',
    callSummary: '',
    okForCaseWorkerToCall: null,
    hasConversationEvolved: 'Não',
    didYouDiscussRightsWithTheChild: null,
    didTheChildFeelWeSolvedTheirProblem: null,
  },
  contactlessTask: {
    date: '',
    time: '',
    channel: '',
    helpline: 'SaferNet',
    createdOnBehalfOf: userTwilioWorkerId,
  },
  childInformation: {
    age: '',
    city: '',
    lastName: '',
    firstName: '',
    email: '',
    state: '',
    gender: '',
    phone1: '',
    phone2: '',
    ethnicity: '',
  },
  callerInformation: {
    age: '',
    city: '',
    lastName: '',
    firstName: '',
    email: '',
    state: '',
    gender: '',
    phone1: '',
    phone2: '',
    relationshipToChild: '',
  },
  definitionVersion: 'br-v1',
};

const createContact = async (twilioWorkerId: string): Promise<contactDb.Contact> => {
  const timeOfContact = formatISO(subMinutes(new Date(), 5));
  const taskSid = `WT${randomBytes(16).toString('hex')}`;
  const channelSid = `CH${randomBytes(16).toString('hex')}`;
  return contactService.createContact(
    accountSid,
    twilioWorkerId,
    {
      rawJson,
      twilioWorkerId,
      timeOfContact,
      taskId: taskSid,
      channelSid,
      queueName: 'Admin',
      helpline: 'helpline',
      conversationDuration: 5,
      serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    },
    ALWAYS_CAN,
  );
};

beforeAll(async () => {
  await clearAllTables();
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(userTwilioWorkerId);
});

afterAll(async () => {
  await Promise.all([mockingProxy.stop(), server.close()]);
});

beforeEach(async () => {
  useOpenRules();
});

afterEach(async () => {
  await clearAllTables();
});

const overridePermissions = <T extends TargetKind>(
  key: keyof RulesFile,
  permissions: TKConditionsSets<T>,
) => {
  useOpenRules();
  const rules: Partial<RulesFile> = {
    [key]: permissions,
  };
  setRules(rules);
};

const overrideViewContactPermissions = (permissions: TKConditionsSets<'contact'>) =>
  overridePermissions('viewContact', permissions);

describe('isOwner', () => {
  type TestCase = {
    description: string;
    viewContactPermissions: TKConditionsSets<'contact'>;
    expectedContactsByOwner: (
      | typeof userTwilioWorkerId
      | typeof anotherUserTwilioWorkerId
    )[];
  };

  const testCases: TestCase[] = [
    {
      description:
        'return only contacts created by the owner when it has isOwner permission',
      viewContactPermissions: [['isOwner']],
      expectedContactsByOwner: [userTwilioWorkerId],
    },
    {
      description:
        'returns everything if isOwner condition set is alongside an everyone set',
      viewContactPermissions: [['isOwner'], ['everyone']],
      expectedContactsByOwner: [userTwilioWorkerId, anotherUserTwilioWorkerId],
    },
  ];

  let usersContact: contactService.Contact;
  let anotherUsersContact: contactService.Contact;

  beforeEach(async () => {
    usersContact = await createContact(userTwilioWorkerId);
    anotherUsersContact = await createContact(anotherUserTwilioWorkerId);
  });

  describe('GET /contacts/:id', () => {
    const routeBase = `/v0/accounts/${accountSid}/contacts`;
    each(testCases).test(
      '$description',
      async ({ viewContactPermissions, expectedContactsByOwner }: TestCase) => {
        overrideViewContactPermissions(viewContactPermissions);

        const responses = await Promise.all(
          [usersContact, anotherUsersContact].map(contact =>
            request.get(`${routeBase}/${contact.id}`).set(headers),
          ),
        );
        const retrievedContacts = responses
          .filter(({ status }) => {
            if (status == 200) {
              return true;
            } else {
              expect(status).toBe(404);
              return false;
            }
          })
          .map(({ body }) => body);
        expect(
          retrievedContacts
            .map((contact: contactDb.Contact) => contact.twilioWorkerId)
            .sort(),
        ).toStrictEqual(expectedContactsByOwner.sort());
      },
    );
  });
  describe('POST /contacts/search', () => {
    const route = `/v0/accounts/${accountSid}/contacts/search`;
    each(testCases).test(
      '$description',
      async ({ viewContactPermissions, expectedContactsByOwner }: TestCase) => {
        overrideViewContactPermissions(viewContactPermissions);

        const searchParams: contactDb.SearchParameters = {
          onlyDataContacts: false,
        };

        const response = await request.post(route).set(headers).send(searchParams);

        expect(response.status).toBe(200);
        expect(response.body.count).toBe(expectedContactsByOwner.length);
        expect(
          response.body.contacts
            .map((contact: contactDb.Contact) => contact.twilioWorkerId)
            .sort(),
        ).toStrictEqual(expectedContactsByOwner.sort());
      },
    );
  });
});
