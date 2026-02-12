"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dbConnection_1 = require("../dbConnection");
const mocks_1 = require("../mocks");
require("../case/caseValidation");
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const caseDb = __importStar(require("@tech-matters/hrm-core/case/caseDataAccess"));
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const contactDb = __importStar(require("@tech-matters/hrm-core/contact/contactDataAccess"));
const server_1 = require("../server");
const dbCleanup_1 = require("./dbCleanup");
const index_1 = require("@tech-matters/hrm-core/permissions/index");
const jest_each_1 = __importDefault(require("jest-each"));
const setupServiceTest_1 = require("../setupServiceTest");
const { request } = (0, setupServiceTest_1.setupServiceTests)();
const route = `/v0/accounts/${mocks_1.accountSid}/contacts`;
const setRulesForPermissionTest = ({ allowAddContactToCase, allowUpdateCaseContacts, allowRemoveContactFromCase, }) => {
    const permittedConditions = [['everyone']];
    const forbiddenConditions = [['isSupervisor']];
    (0, server_1.setRules)({
        [index_1.actionsMaps.case.UPDATE_CASE_CONTACTS]: allowUpdateCaseContacts
            ? permittedConditions
            : forbiddenConditions,
        [index_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE]: allowRemoveContactFromCase
            ? permittedConditions
            : forbiddenConditions,
        [index_1.actionsMaps.contact.ADD_CONTACT_TO_CASE]: allowAddContactToCase
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
        createdContact = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact1, mocks_1.ALWAYS_CAN, true);
        createdCase = await caseApi.createCase(mocks_1.case1, mocks_1.accountSid, mocks_1.workerSid, undefined, true);
        anotherCreatedCase = await caseApi.createCase(mocks_1.case2, mocks_1.accountSid, mocks_1.workerSid, undefined, true);
        const contactToBeDeleted = await contactApi.createContact(mocks_1.accountSid, mocks_1.workerSid, mocks_1.contact2, mocks_1.ALWAYS_CAN, true);
        const caseToBeDeleted = await caseApi.createCase(mocks_1.case1, mocks_1.accountSid, mocks_1.workerSid);
        existingContactId = createdContact.id;
        existingCaseId = createdCase.id;
        anotherExistingCaseId = anotherCreatedCase.id;
        nonExistingContactId = contactToBeDeleted.id;
        nonExistingCaseId = caseToBeDeleted.id;
        await (0, dbCleanup_1.deleteContactById)(parseInt(contactToBeDeleted.id), contactToBeDeleted.accountSid);
        await caseDb.deleteById(parseInt(caseToBeDeleted.id), mocks_1.accountSid);
    });
    afterEach(async () => {
        await (0, dbCleanup_1.deleteContactById)(createdContact.id, createdContact.accountSid);
        await caseDb.deleteById(createdCase.id, mocks_1.accountSid);
        await caseDb.deleteById(anotherCreatedCase.id, mocks_1.accountSid);
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
                .set(server_1.headers)
                .send({ caseId: existingCaseId });
            expect(response.status).toBe(200);
            expect(response.body.caseId).toBe(existingCaseId);
            // Test the association
            expect(response.body.csamReports).toHaveLength(0);
        });
        // const selectCreatedCaseAudits = () =>
        // `SELECT * FROM "Audits" WHERE "tableName" = 'Cases' AND ("oldRecord"->>'id' = '${createdCase.id}' OR "newRecord"->>'id' = '${createdCase.id}')`;
        const countCasesAudits = async () => parseInt((await dbConnection_1.db.task(t => t.any(`SELECT COUNT(*) FROM "Audits" WHERE "tableName" = 'Cases'`)))[0].count, 10);
        const selectCasesAudits = () => dbConnection_1.db.task(t => t.any(`SELECT * FROM "Audits" WHERE "tableName" = 'Cases'`));
        const countContactsAudits = async () => parseInt((await dbConnection_1.db.task(t => t.any(`SELECT COUNT(*) FROM "Audits" WHERE "tableName" = 'Contacts'`)))[0].count, 10);
        const selectContactsAudits = () => dbConnection_1.db.task(t => t.any(`SELECT * FROM "Audits" WHERE "tableName" = 'Contacts'`));
        test('should create a CaseAudit', async () => {
            const casesAuditPreviousCount = await countCasesAudits();
            const contactsAuditPreviousCount = await countContactsAudits();
            const response = await request
                .put(subRoute(existingContactId))
                .set(server_1.headers)
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
                .set(server_1.headers)
                .send({ caseId: existingCaseId });
            expect(response1.status).toBe(200);
            const casesAuditPreviousCount = await countCasesAudits();
            const contactsAuditPreviousCount = await countContactsAudits();
            // repeat above operation (should do nothing but emit an audit)
            const response2 = await request
                .put(subRoute(existingContactId))
                .set(server_1.headers)
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
                .set(server_1.headers)
                .send({ caseId: existingCaseId });
            expect(response1.status).toBe(200);
            const casesAuditPreviousCount = await countCasesAudits();
            const contactsAuditPreviousCount = await countContactsAudits();
            // repeat above operation (should do nothing but emit an audit)
            const response2 = await request
                .put(subRoute(existingContactId))
                .set(server_1.headers)
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
                    .set(server_1.headers)
                    .send({ caseId: existingCaseId });
                expect(response.status).toBe(404);
            });
        });
        describe('use non-existent caseId', () => {
            test('should return 404', async () => {
                const response = await request
                    .put(subRoute(existingContactId))
                    .set(server_1.headers)
                    .send({ caseId: nonExistingCaseId });
                expect(response.status).toBe(404);
            });
        });
        describe('permissions', () => {
            const testCases = [
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
            (0, jest_each_1.default)(testCases).test('User has permissions UPDATE_CASE_CONTACTS: $allowUpdateCaseContacts, REMOVE_CONTACT_FROM_CASE: $allowRemoveContactFromCase and ADD_CONTACT_TO_CASE: $allowAddContactToCase, action permitted: $expectActionIsPermitted', async (testCase) => {
                setRulesForPermissionTest(testCase);
                const response = await request
                    .put(subRoute(existingContactId))
                    .set(server_1.headers)
                    .send({ caseId: existingCaseId });
                if (testCase.expectActionIsPermitted) {
                    expect(response.status).toBe(200);
                    expect(response.body.caseId).toBe(existingCaseId);
                    const contact = await contactDb.getById(mocks_1.accountSid, response.body.id);
                    expect(contact.caseId.toString()).toBe(existingCaseId);
                }
                else {
                    expect(response.status).toBe(403);
                }
            });
        });
    });
    describe('DELETE', () => {
        const subRoute = contactId => `${route}/${contactId}/connectToCase`;
        beforeEach(async () => {
            await contactApi.connectContactToCase(mocks_1.accountSid, existingContactId, existingCaseId, mocks_1.ALWAYS_CAN, true);
        });
        test('should return 401', async () => {
            const response = await request.delete(subRoute(existingContactId));
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        test('contact exists and user has permission - should return 200', async () => {
            const response = await request.delete(subRoute(existingContactId)).set(server_1.headers);
            const contact = await contactDb.getById(mocks_1.accountSid, response.body.id);
            expect(response.status).toBe(200);
            expect(response.body.caseId).toBe(undefined);
            expect(contact.caseId).toBe(null);
        });
        test('non existent contact Id - should return 404', async () => {
            const response = await request.delete(subRoute(nonExistingContactId)).set(server_1.headers);
            expect(response.status).toBe(404);
        });
        describe('permissions', () => {
            const testCases = [
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
            (0, jest_each_1.default)(testCases).test('User has permissions UPDATE_CASE_CONTACTS: $allowUpdateCaseContacts, REMOVE_CONTACT_FROM_CASE: $allowRemoveContactFromCase and ADD_CONTACT_TO_CASE: $allowAddContactToCase, action permitted: $expectActionIsPermitted', async (testCase) => {
                setRulesForPermissionTest(testCase);
                const response = await request.delete(subRoute(existingContactId)).set(server_1.headers);
                if (testCase.expectActionIsPermitted) {
                    expect(response.status).toBe(200);
                    expect(response.body.caseId).toBe(undefined);
                    const contact = await contactDb.getById(mocks_1.accountSid, response.body.id);
                    expect(contact.caseId).toBe(null);
                }
                else {
                    expect(response.status).toBe(403);
                }
            });
        });
    });
});
