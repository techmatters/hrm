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
import { TKConditionsSets, RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import { headers, setRules, useOpenRules } from './server';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import * as contactService from '@tech-matters/hrm-core/contact/contactService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import * as caseService from '@tech-matters/hrm-core/case/caseService';
import { TargetKind } from '@tech-matters/hrm-core/permissions/actions';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { AccountSID, WorkerSID } from '@tech-matters/types';
import { ALWAYS_CAN } from './mocks';
import { setupServiceTests } from './setupServiceTest';
import { create } from '@tech-matters/hrm-core/case/caseDataAccess';

const accountSid: AccountSID = `AC${randomBytes(16).toString('hex')}`;
const userTwilioWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
const anotherUserTwilioWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;

const { request } = setupServiceTests(userTwilioWorkerId);

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
  definitionVersion: 'as-v1',
};

const createContact = async (twilioWorkerId: WorkerSID): Promise<contactDb.Contact> => {
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
      definitionVersion: 'as-v1',
    },
    ALWAYS_CAN,
  );
};

const createCase = async (twilioWorkerId: WorkerSID) => {
  return create({
    createdAt: new Date().toISOString(),
    createdBy: twilioWorkerId,
    accountSid,
    twilioWorkerId,
    status: 'open',
    helpline: 'helpline',
    info: { summary: 'something summery' },
    definitionVersion: 'as-v1',
  });
};

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

const overrideViewCasePermissions = (permissions: TKConditionsSets<'case'>) =>
  overridePermissions('viewCase', permissions);

describe('list cases permissions', () => {
  const route = `/v0/accounts/${accountSid}/cases/list`;
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
    expect(response.body.cases[0].id).toBe(otherUserCase.id.toString());
  });

  test('return own cases when view is restricted', async () => {
    overrideViewCasePermissions([['isCreator']]);
    const response = await request.post(route).set(headers).send({});

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.cases.length).toStrictEqual(1);
    expect(response.body.cases[0].id).toBe(userCase.id.toString());
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
        connect(parseInt(userContact.id), caseWithUserContact.id),
        connect(parseInt(otherUserContact.id), caseWithUserContact.id),
        connect(parseInt(otherUserContact.id), caseWithNoUserContact.id),
        connect(parseInt(userContact2.id), userCaseWithUserContact.id),
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
          .sort()
          .map(id => id.toString()),
      );
    });
    test('Returns only cases with a connected contact owned by the user when isCaseContactOwner permission is in use', async () => {
      overrideViewCasePermissions([['isCaseContactOwner']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
      expect(response.body.cases.length).toBe(2);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [caseWithUserContact, userCaseWithUserContact]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort()
          .map(id => id.toString()),
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
        [caseWithUserContact]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort()
          .map(id => id.toString()),
      );
    });
    test('Combines with isCreator condition to only return cases created by the user AND with contacts owned by the user', async () => {
      overrideViewCasePermissions([['isCaseContactOwner', 'isCreator']]);

      const response = await request.post(route).set(headers).send({});

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.cases.length).toBe(1);
      expect(response.body.cases.map((c: caseDb.CaseRecord) => c.id).sort()).toEqual(
        [userCaseWithUserContact]
          .map((c: caseDb.CaseRecord) => c.id)
          .sort()
          .map(id => id.toString()),
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
          .sort()
          .map(id => id.toString()),
      );
    });
  });
});
