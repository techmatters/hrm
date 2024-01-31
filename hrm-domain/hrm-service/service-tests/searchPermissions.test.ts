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

import { db } from '@tech-matters/hrm-core/connection-pool';
import { TKConditionsSets, RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import { headers, getRequest, getServer, setRules, useOpenRules } from './server';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import * as contactService from '@tech-matters/hrm-core/contact/contactService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import * as caseService from '@tech-matters/hrm-core/case/caseService';
import { TargetKind } from '@tech-matters/hrm-core/permissions/actions';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { AccountSID } from '@tech-matters/types';
import { ALWAYS_CAN } from './mocks';

useOpenRules();
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

const createCase = async (twilioWorkerId: string) => {
  return caseService.createCase(
    { status: 'open', helpline: 'helpline', info: { summary: 'something summery' } },
    accountSid,
    twilioWorkerId,
  );
};

const cleanUpDB = async () => {
  await db.task(async t => {
    await Promise.all([
      t.none(`DELETE FROM "Contacts";`),
      t.none(`DELETE FROM "Cases";`),
    ]);
  });
};

beforeAll(async () => {
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
  await cleanUpDB();
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

const overrideViewCasePermissions = (permissions: TKConditionsSets<'case'>) =>
  overridePermissions('viewCase', permissions);

describe('search contacts permissions', () => {
  const route = `/v0/accounts/${accountSid}/contacts/search`;

  test('return zero contacts when no permissions', async () => {
    await createContact(userTwilioWorkerId);
    await createContact(anotherUserTwilioWorkerId);

    overrideViewContactPermissions([['isSupervisor'], ['isOwner']]);

    const searchParams: contactDb.SearchParameters = {
      counselor: anotherUserTwilioWorkerId,
      onlyDataContacts: false,
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.contacts.length).toBe(0);
  });

  test('override counselor and return contacts', async () => {
    await createContact(userTwilioWorkerId);
    await createContact(anotherUserTwilioWorkerId);

    overrideViewContactPermissions([['everyone']]);

    const searchParams: contactDb.SearchParameters = {
      counselor: anotherUserTwilioWorkerId,
      onlyDataContacts: false,
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.contacts.length).toBe(1);
  });

  test('return all contacts', async () => {
    await createContact(userTwilioWorkerId);
    await createContact(anotherUserTwilioWorkerId);

    overrideViewContactPermissions([['everyone']]);

    const searchParams: contactDb.SearchParameters = {
      counselor: undefined,
      onlyDataContacts: false,
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.contacts.length).toBe(2);
  });
});

describe('search cases permissions', () => {
  const route = `/v0/accounts/${accountSid}/cases/search`;
  let userCase: caseDb.CaseRecord, otherUserCase: caseDb.CaseRecord;

  beforeEach(async () => {
    userCase = await createCase(userTwilioWorkerId);
    otherUserCase = await createCase(anotherUserTwilioWorkerId);
  });

  test('return zero cases when no permissions', async () => {
    overrideViewCasePermissions([['isSupervisor'], ['isCreator']]);

    const searchParams: caseService.SearchParameters = {
      filters: {
        counsellors: [anotherUserTwilioWorkerId],
      },
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.cases.length).toBe(0);
  });

  test('return cases from other counselors', async () => {
    overrideViewCasePermissions([['everyone']]);

    const searchParams: caseService.SearchParameters = {
      filters: {
        counsellors: [anotherUserTwilioWorkerId],
      },
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.cases.length).toBe(1);
    expect(response.body.cases[0].id).toBe(otherUserCase.id);
  });

  test('return own cases when view is restricted', async () => {
    overrideViewCasePermissions([['isCreator']]);
    const response = await request.post(route).set(headers).send({});

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.cases.length).toStrictEqual(1);
    expect(response.body.cases[0].id).toBe(userCase.id);
  });

  test('return all cases', async () => {
    overrideViewCasePermissions([['everyone']]);
    const response = await request.post(route).set(headers).send({});

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.cases.length).toBe(2);
  });

  describe('A contact in the case is owned by the user', () => {
    let userContact: contactDb.Contact,
      userContact2: contactDb.Contact,
      otherUserContact: contactDb.Contact;
    let caseWithUserContact: caseDb.CaseRecord,
      caseWithNoUserContact: caseDb.CaseRecord,
      userCaseWithUserContact: caseDb.CaseRecord;
    const ctc = contactDb.connectToCase();
    const connect = (contactId: number, caseId: number) =>
      ctc(accountSid, contactId.toString(), caseId.toString(), userTwilioWorkerId);

    beforeEach(async () => {
      [
        userContact,
        userContact2,
        otherUserContact,
        caseWithNoUserContact,
        caseWithUserContact,
        userCaseWithUserContact,
      ] = await Promise.all([
        createContact(userTwilioWorkerId),
        createContact(userTwilioWorkerId),
        createContact(anotherUserTwilioWorkerId),
        createCase(anotherUserTwilioWorkerId),
        createCase(anotherUserTwilioWorkerId),
        createCase(userTwilioWorkerId),
      ]);
      await Promise.all([
        connect(userContact.id, caseWithUserContact.id),
        connect(otherUserContact.id, caseWithUserContact.id),
        connect(otherUserContact.id, caseWithNoUserContact.id),
        connect(userContact2.id, userCaseWithUserContact.id),
      ]);
    });
    test('Ignores owned contact when isCaseContactOwner permission is not in use', async () => {
      overrideViewCasePermissions([['everyone']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(5);
      expect(response.body.cases.length).toBe(5);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [
          userCase,
          otherUserCase,
          caseWithNoUserContact,
          caseWithUserContact,
          userCaseWithUserContact,
        ]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort(),
      );
    });
    test('Returns only cases with a connected contact owned by the user when isCaseContactOwner permission is in use', async () => {
      overrideViewCasePermissions([['isCaseContactOwner']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      console.log(JSON.stringify(response.body.cases, null, 2));
      expect(response.body.count).toBe(2);
      expect(response.body.cases.length).toBe(2);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [caseWithUserContact, userCaseWithUserContact]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort(),
      );
    });
    test('Combines with counselor filters to only return cases created by counselors listed in the filter with contacts owned by the user', async () => {
      overrideViewCasePermissions([['isCaseContactOwner']]);

      const response = await request
        .post(route)
        .set(headers)
        .send({
          filters: {
            counsellors: [anotherUserTwilioWorkerId],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.cases.length).toBe(1);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [caseWithUserContact].map((c: caseDb.CaseRecord) => c.id).sort(),
      );
    });
    test('Combines with isCreator condition to only return cases created by the user AND with contacts owned by the user', async () => {
      overrideViewCasePermissions([['isCaseContactOwner', 'isCreator']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.cases.length).toBe(1);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [userCaseWithUserContact].map((c: caseDb.CaseRecord) => c.id).sort(),
      );
    });
    test('Combines with a separate isCreator condition set to return cases created by the user OR with contacts owned by the user', async () => {
      overrideViewCasePermissions([['isCaseContactOwner'], ['isCreator']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(3);
      expect(response.body.cases.length).toBe(3);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [userCase, caseWithUserContact, userCaseWithUserContact]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort(),
      );
    });
  });
});
