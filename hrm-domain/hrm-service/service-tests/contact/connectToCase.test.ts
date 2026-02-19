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

import { db } from '../dbConnection';
import {
  accountSid,
  ALWAYS_CAN,
  case1,
  case2,
  contact1,
  contact2,
  workerSid,
} from '../mocks';
import '../case/caseValidation';
import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import { headers, setRules } from '../server';
import { deleteContactById } from './dbCleanup';
import { actionsMaps } from '@tech-matters/hrm-core/permissions/index';
import { TKConditionsSets } from '@tech-matters/hrm-core/permissions/rulesMap';
import each from 'jest-each';
import { setupServiceTests } from '../setupServiceTest';

const { request } = setupServiceTests();

const route = `/v0/accounts/${accountSid}/contacts`;

type PermissionTestCase = {
  allowAddContactToCase: boolean;
  allowRemoveContactFromCase: boolean;
  allowUpdateCaseContacts: boolean;
  expectActionIsPermitted: boolean;
};

const setRulesForPermissionTest = ({
  allowAddContactToCase,
  allowUpdateCaseContacts,
  allowRemoveContactFromCase,
}: PermissionTestCase) => {
  const permittedConditions: TKConditionsSets<'case'> = [['everyone']];
  const forbiddenConditions: TKConditionsSets<'case'> = [['isSupervisor']];
  setRules({
    [actionsMaps.case.UPDATE_CASE_CONTACTS]: allowUpdateCaseContacts
      ? permittedConditions
      : forbiddenConditions,
    [actionsMaps.contact.REMOVE_CONTACT_FROM_CASE]: allowRemoveContactFromCase
      ? permittedConditions
      : forbiddenConditions,
    [actionsMaps.contact.ADD_CONTACT_TO_CASE]: allowAddContactToCase
      ? permittedConditions
      : forbiddenConditions,
  });
};

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
      <any>contact1,
      ALWAYS_CAN,
      true,
    );
    createdCase = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
    anotherCreatedCase = await caseApi.createCase(
      case2,
      accountSid,
      workerSid,
      undefined,
      true,
    );
    const contactToBeDeleted = await contactApi.createContact(
      accountSid,
      workerSid,
      <any>contact2,
      ALWAYS_CAN,
      true,
    );
    const caseToBeDeleted = await caseApi.createCase(case1, accountSid, workerSid);

    existingContactId = createdContact.id;
    existingCaseId = createdCase.id;
    anotherExistingCaseId = anotherCreatedCase.id;
    nonExistingContactId = contactToBeDeleted.id;
    nonExistingCaseId = caseToBeDeleted.id;

    await deleteContactById(
      parseInt(contactToBeDeleted.id),
      contactToBeDeleted.accountSid,
    );
    await caseDb.deleteById(parseInt(caseToBeDeleted.id), accountSid);
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
      expect(newRecord.caseId.toString()).toBe(existingCaseId);
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
    describe('permissions', () => {
      const testCases: PermissionTestCase[] = [
        {
          allowAddContactToCase: false,
          allowRemoveContactFromCase: true,
          allowUpdateCaseContacts: true,
          expectActionIsPermitted: false,
        },
        {
          allowAddContactToCase: true,
          allowRemoveContactFromCase: false,
          allowUpdateCaseContacts: true,
          expectActionIsPermitted: true,
        },
        {
          allowAddContactToCase: true,
          allowRemoveContactFromCase: true,
          allowUpdateCaseContacts: false,
          expectActionIsPermitted: false,
        },
      ];
      each(testCases).test(
        'User has permissions UPDATE_CASE_CONTACTS: $allowUpdateCaseContacts, REMOVE_CONTACT_FROM_CASE: $allowRemoveContactFromCase and ADD_CONTACT_TO_CASE: $allowAddContactToCase, action permitted: $expectActionIsPermitted',
        async (testCase: PermissionTestCase) => {
          setRulesForPermissionTest(testCase);
          const response = await request
            .put(subRoute(existingContactId))
            .set(headers)
            .send({ caseId: existingCaseId });

          if (testCase.expectActionIsPermitted) {
            expect(response.status).toBe(200);
            expect(response.body.caseId).toBe(existingCaseId);

            const contact = await contactDb.getById(accountSid, response.body.id);

            expect(contact.caseId.toString()).toBe(existingCaseId);
          } else {
            expect(response.status).toBe(403);
          }
        },
      );
    });
  });
  describe('DELETE', () => {
    const subRoute = contactId => `${route}/${contactId}/connectToCase`;

    beforeEach(async () => {
      await contactApi.connectContactToCase(
        accountSid,
        existingContactId,
        existingCaseId,
        ALWAYS_CAN,
        true,
      );
    });

    test('should return 401', async () => {
      const response = await request.delete(subRoute(existingContactId));

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('contact exists and user has permission - should return 200', async () => {
      const response = await request.delete(subRoute(existingContactId)).set(headers);

      const contact = await contactDb.getById(accountSid, response.body.id);

      expect(response.status).toBe(200);
      expect(response.body.caseId).toBe(undefined);
      expect(contact.caseId).toBe(null);
    });

    test('non existent contact Id - should return 404', async () => {
      const response = await request.delete(subRoute(nonExistingContactId)).set(headers);

      expect(response.status).toBe(404);
    });

    describe('permissions', () => {
      const testCases: PermissionTestCase[] = [
        {
          allowAddContactToCase: false,
          allowRemoveContactFromCase: true,
          allowUpdateCaseContacts: true,
          expectActionIsPermitted: true,
        },
        {
          allowAddContactToCase: true,
          allowRemoveContactFromCase: false,
          allowUpdateCaseContacts: true,
          expectActionIsPermitted: false,
        },
        {
          allowAddContactToCase: true,
          allowRemoveContactFromCase: true,
          allowUpdateCaseContacts: false,
          expectActionIsPermitted: false,
        },
      ];
      each(testCases).test(
        'User has permissions UPDATE_CASE_CONTACTS: $allowUpdateCaseContacts, REMOVE_CONTACT_FROM_CASE: $allowRemoveContactFromCase and ADD_CONTACT_TO_CASE: $allowAddContactToCase, action permitted: $expectActionIsPermitted',
        async (testCase: PermissionTestCase) => {
          setRulesForPermissionTest(testCase);
          const response = await request.delete(subRoute(existingContactId)).set(headers);
          if (testCase.expectActionIsPermitted) {
            expect(response.status).toBe(200);
            expect(response.body.caseId).toBe(undefined);

            const contact = await contactDb.getById(accountSid, response.body.id);

            expect(contact.caseId).toBe(null);
          } else {
            expect(response.status).toBe(403);
          }
        },
      );
    });
  });
});
