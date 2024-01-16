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

import { db } from '@tech-matters/hrm-core/src/connection-pool';
import {
  TKConditionsSets,
  RulesFile,
} from '@tech-matters/hrm-core/src/permissions/rulesMap';
import {
  headers,
  getRequest,
  getServer,
  setRules,
  defaultConfig,
  useOpenRules,
} from './server';
import { SearchParameters as ContactSearchParameters } from '@tech-matters/hrm-core/src/contact/contactDataAccess';
import { SearchParameters as CaseSearchParameters } from '@tech-matters/hrm-core/src/case/caseService';
import { TargetKind } from '@tech-matters/hrm-core/src/permissions/actions';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const accountSid = `AC${randomBytes(16).toString('hex')}`;
const userTwilioWorkerId = `WK${randomBytes(16).toString('hex')}`;
const anotherUserTwilioWorkerId = `WK${randomBytes(16).toString('hex')}`;
const rawJson =
  '{"callType": "Silent", "caseInformation": {"categories": {"Violência": {"Bullying": false, "Sextorsão": false, "Cyberstalking": false, "Discurso de ódio": false, "Unspecified/Other": false, "Encontros Virtuais": false, "Ciberbullying/Ofensa": false, "Orientações gerais": false, "Conteúdo ilegal/danoso": false, "Fraudes/Golpes/Phishing": false, "Abuso sexual infantil online": false, "Problemas com compras online": false, "Problemas com dados pessoais": false, "Aliciamento sexual infantil online": false, "Outras formas de violência online": false, "Exploração sexual infantil online": false, "Mediação Parental/literacia digital": false, "Compartilhamento não consensual de imagens íntimas": false}, "Saúde mental": {"Suicídio": false, "Automutilação": false, "Inespecífico/Outros": false, "Transtornos Alimentares": false, "Uso excessivo/exagerado": false}, "Outras informação e contatos não relacionados com orientação": {"Feedback": false, "Imprensa": false, "Interrupção/Queda": false, "Solicitação De Material/Palestras": false, "Outras informação e contatos não relacionados com orientação": false}}, "actionTaken": "", "callSummary": "", "okForCaseWorkerToCall": null, "hasConversationEvolved": "Não", "didYouDiscussRightsWithTheChild": null, "didTheChildFeelWeSolvedTheirProblem": null}, "contactlessTask": {"date": "", "time": "", "channel": "", "helpline": "SaferNet", "createdOnBehalfOf": "WKd3d289370720216aab7e3db023e80f3e"}, "childInformation": {"age": "", "city": "", "name": {"lastName": "", "firstName": ""}, "email": "", "state": "", "gender": "", "phone1": "", "phone2": "", "ethnicity": ""}, "callerInformation": {"age": "", "city": "", "name": {"lastName": "", "firstName": ""}, "email": "", "state": "", "gender": "", "phone1": "", "phone2": "", "relationshipToChild": ""}, "definitionVersion": "br-v1"}';

const createContact = async (twilioWorkerId: string) => {
  const date = formatISO(new Date());
  const timeOfContact = formatISO(subMinutes(new Date(), 5));
  const taskSid = `WT${randomBytes(16).toString('hex')}`;
  const channelSid = `CH${randomBytes(16).toString('hex')}`;

  await db.task(t =>
    t.none(
      `INSERT INTO "Contacts" ("createdAt","updatedAt","rawJson","queueName","twilioWorkerId",helpline,"number",channel,"conversationDuration","caseId","accountSid","timeOfContact","taskId","createdBy","channelSid","serviceSid") VALUES ('${date}','${date}','${rawJson}','Admin','${twilioWorkerId}','helpline','37.228.237.15','web',300,NULL,'${accountSid}','${timeOfContact}','${taskSid}','${twilioWorkerId}','${channelSid}','ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');`,
    ),
  );
};

const createCase = async (twilioWorkerId: string) => {
  const date = formatISO(new Date());
  const info =
    '{"summary":"something summary","perpetrators":[],"households":[],"incidents":[],"documents":[],"referrals":[],"counsellorNotes":[]}';

  await db.task(t =>
    t.none(
      `INSERT INTO "Cases" ("createdAt", "updatedAt", status, helpline, info, "twilioWorkerId", "accountSid", "createdBy", "updatedBy") VALUES ('${date}','${date}','open','helpline','${info}','${twilioWorkerId}','${accountSid}','${twilioWorkerId}','${twilioWorkerId}');`,
    ),
  );
};

const cleanUpDB = async () => {
  await db.task(t =>
    t.none(
      `DELETE FROM "Contacts" WHERE "twilioWorkerId" IN ('${userTwilioWorkerId}', '${anotherUserTwilioWorkerId}');`,
    ),
  );

  await db.task(t =>
    t.none(
      `DELETE FROM "Cases" WHERE "twilioWorkerId" IN ('${userTwilioWorkerId}', '${anotherUserTwilioWorkerId}');`,
    ),
  );
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
  key: string,
  permissions: TKConditionsSets<T>,
) => {
  useOpenRules();
  const rules: RulesFile = {
    ...(defaultConfig.permissions?.rules() as RulesFile),
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

    const searchParams: ContactSearchParameters = {
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

    const searchParams: ContactSearchParameters = {
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

    const searchParams: ContactSearchParameters = {
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

  test('return zero cases when no permissions', async () => {
    await createCase(userTwilioWorkerId);
    await createCase(anotherUserTwilioWorkerId);

    overrideViewCasePermissions([['isSupervisor'], ['isCreator']]);

    const searchParams: CaseSearchParameters = {
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
    await createCase(userTwilioWorkerId);
    await createCase(anotherUserTwilioWorkerId);

    overrideViewCasePermissions([['everyone']]);

    const searchParams: CaseSearchParameters = {
      filters: {
        counsellors: [anotherUserTwilioWorkerId],
      },
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.cases.length).toBe(1);
  });

  test('return all cases', async () => {
    await createCase(userTwilioWorkerId);
    await createCase(anotherUserTwilioWorkerId);

    overrideViewCasePermissions([['everyone']]);

    const searchParams: CaseSearchParameters = {
      filters: {
        counsellors: [],
      },
    };

    const response = await request.post(route).set(headers).send(searchParams);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.cases.length).toBe(2);
  });
});
