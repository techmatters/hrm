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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This test suit intends to test that the audit_trigger function is set for the target tables and row operations and working as expected.
 * The shape of the json columns of each table have been simplified to avoid noise in this tests.
 */
const dbConnection_1 = require("../dbConnection");
require("../case/caseValidation");
const workerSid = 'WK-worker-sid';
const anotherWorkerSid = 'WK-another-worker-sid';
const testAccountSid = 'test-account-sid';
const definitionVersion = 'as-v1';
describe('Cases_audit_trigger', () => {
    let createdCase;
    const selectCreatedCaseAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'Cases' AND (
      ("oldRecord"->>'id' = '${createdCase.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}') 
      OR 
      ("newRecord"->>'id' = '${createdCase.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Cases' AND (
          ("oldRecord"->>'id' = '${createdCase.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR
          ("newRecord"->>'id' = '${createdCase.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`DELETE FROM "Cases" WHERE  id = ${createdCase.id} AND "accountSid" = '${testAccountSid}'`));
    });
    test('INSERT audit', async () => {
        createdCase = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Cases" ("info", helpline, status, "twilioWorkerId", "createdBy", "accountSid", "createdAt", "updatedAt", "updatedBy", "definitionVersion")
        VALUES ('{}'::jsonb, '', 'open', '${workerSid}', '${workerSid}', '${testAccountSid}', current_timestamp, current_timestamp, NULL, '${definitionVersion}')
        RETURNING *;
      `));
        expect(createdCase).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Cases',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdCase,
                createdAt: expect.toParseAsDate(createdCase.createdAt),
                updatedAt: expect.toParseAsDate(createdCase.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseAudits));
        expect(caseAudits).toHaveLength(1);
        expect(caseAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedCase = await dbConnection_1.db.task(t => t.one(`UPDATE "Cases" SET "info" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdCase.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedCase).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Cases',
            operation: 'UPDATE',
            oldRecord: {
                ...createdCase,
                createdAt: expect.toParseAsDate(createdCase.createdAt),
                updatedAt: expect.toParseAsDate(createdCase.updatedAt),
            },
            newRecord: {
                ...updatedCase,
                createdAt: expect.toParseAsDate(updatedCase.createdAt),
                updatedAt: expect.toParseAsDate(updatedCase.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseAudits));
        expect(caseAudits).toHaveLength(2);
        expect(caseAudits[1]).toMatchObject(expectedAudit);
        createdCase = updatedCase;
    });
    test('DELETE audit', async () => {
        const deletedCase = await dbConnection_1.db.task(t => t.none(`DELETE FROM "Cases" WHERE id = ${createdCase.id} AND "accountSid" = '${testAccountSid}';`));
        expect(deletedCase).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Cases',
            operation: 'DELETE',
            oldRecord: {
                ...createdCase,
                createdAt: expect.toParseAsDate(createdCase.createdAt),
                updatedAt: expect.toParseAsDate(createdCase.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseAudits));
        expect(caseAudits).toHaveLength(3);
        expect(caseAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('CaseSections_audit_trigger', () => {
    let createdCase;
    let createdCaseSection;
    const sectionName = 'section';
    const sectionId = '123';
    const selectCreatedCaseSectionAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'CaseSections' AND (
      ("oldRecord"->>'caseId' = '${createdCase.id}' AND "oldRecord"->>'sectionType' = '${sectionName}'  AND "oldRecord"->>'sectionId' = '${sectionId}')
      OR
      ("newRecord"->>'caseId' = '${createdCase.id}' AND "newRecord"->>'sectionType' = '${sectionName}'  AND "newRecord"->>'sectionId' = '${sectionId}')
    )
    ORDER BY "timestamp_clock" ASC
    `;
    beforeAll(async () => {
        createdCase = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Cases" ("info", helpline, status, "twilioWorkerId", "createdBy", "accountSid", "createdAt", "updatedAt", "updatedBy", "definitionVersion")
        VALUES ('{}'::jsonb, '', 'open', '${workerSid}', '${workerSid}', '${testAccountSid}', current_timestamp, current_timestamp, NULL, '${definitionVersion}')
        RETURNING *;
      `));
    });
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`DELETE FROM "Audits" WHERE "tableName" = 'CaseSections' AND (
          ("oldRecord"->>'caseId' = '${createdCase.id}' AND "oldRecord"->>'sectionType' = '${sectionName}'  AND "oldRecord"->>'sectionId' = '${sectionId}')
          OR
          ("newRecord"->>'caseId' = '${createdCase.id}' AND "newRecord"->>'sectionType' = '${sectionName}'  AND "newRecord"->>'sectionId' = '${sectionId}')
        )`));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits"
        WHERE "tableName" = 'Cases' AND (
          ("oldRecord"->>'id' = '${createdCase.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}' )
          OR 
          ("newRecord"->>'id' = '${createdCase.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`DELETE FROM "Cases" WHERE  id = ${createdCase.id} AND "accountSid" = '${testAccountSid}'`));
    });
    test('INSERT audit', async () => {
        createdCaseSection = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "CaseSections" ("caseId", "sectionType", "sectionId", "createdAt", "createdBy", "updatedAt", "updatedBy", "sectionTypeSpecificData", "accountSid")
        VALUES (${createdCase.id}, '${sectionName}', '${sectionId}', current_timestamp, '${workerSid}', current_timestamp, '${workerSid}', '{}'::jsonb, '${testAccountSid}')
        RETURNING *;
      `));
        expect(createdCaseSection).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'CaseSections',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdCaseSection,
                createdAt: expect.toParseAsDate(createdCaseSection.createdAt),
                updatedAt: expect.toParseAsDate(createdCaseSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(createdCaseSection.eventTimestamp),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseSectionAudits()));
        expect(caseSectionAudits).toHaveLength(1);
        expect(caseSectionAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedCaseSection = await dbConnection_1.db.task(t => t.one(`
        UPDATE "CaseSections" SET "sectionTypeSpecificData" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}'
        WHERE "caseId" = ${createdCaseSection.caseId} AND "sectionType" = '${createdCaseSection.sectionType}' AND "sectionId" = '${createdCaseSection.sectionId}'
        RETURNING *;
      `));
        expect(updatedCaseSection).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'CaseSections',
            operation: 'UPDATE',
            oldRecord: {
                ...createdCaseSection,
                createdAt: expect.toParseAsDate(createdCaseSection.createdAt),
                updatedAt: expect.toParseAsDate(createdCaseSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(createdCaseSection.eventTimestamp),
            },
            newRecord: {
                ...updatedCaseSection,
                createdAt: expect.toParseAsDate(updatedCaseSection.createdAt),
                updatedAt: expect.toParseAsDate(updatedCaseSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(updatedCaseSection.eventTimestamp),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseSectionAudits()));
        expect(caseSectionAudits).toHaveLength(2);
        expect(caseSectionAudits[1]).toMatchObject(expectedAudit);
        createdCaseSection = updatedCaseSection;
    });
    test('DELETE audit', async () => {
        const deletedCaseSection = await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "CaseSections"
        WHERE "caseId" = ${createdCaseSection.caseId} AND "sectionType" = '${createdCaseSection.sectionType}' AND "sectionId" = '${createdCaseSection.sectionId}';
      `));
        expect(deletedCaseSection).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'CaseSections',
            operation: 'DELETE',
            oldRecord: {
                ...createdCaseSection,
                createdAt: expect.toParseAsDate(createdCaseSection.createdAt),
                updatedAt: expect.toParseAsDate(createdCaseSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(createdCaseSection.eventTimestamp),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const caseSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedCaseSectionAudits()));
        expect(caseSectionAudits).toHaveLength(3);
        expect(caseSectionAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('Contacts_audit_trigger', () => {
    let createdContact;
    const selectCreatedContactAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'Contacts' AND (
      ("oldRecord"->>'id' = '${createdContact.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'id' = '${createdContact.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Contacts' AND (
          ("oldRecord"->>'id' = '${createdContact.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdContact.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Contacts" WHERE id = ${createdContact.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    test('INSERT audit', async () => {
        createdContact = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Contacts" ("rawJson", "helpline", "accountSid", "createdBy", "createdAt", "updatedAt", "updatedBy", "definitionVersion")
        VALUES ('{}'::jsonb, '', '${testAccountSid}', '${workerSid}', current_timestamp, current_timestamp, NULL, '${definitionVersion}')
        RETURNING *;
      `));
        expect(createdContact).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Contacts',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdContact,
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                updatedAt: expect.toParseAsDate(createdContact.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const contactAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedContactAudits()));
        expect(contactAudits).toHaveLength(1);
        expect(contactAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedContact = await dbConnection_1.db.task(t => t.one(`UPDATE "Contacts" SET "rawJson" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdContact.id} RETURNING *;`));
        expect(updatedContact).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Contacts',
            operation: 'UPDATE',
            oldRecord: {
                ...createdContact,
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                updatedAt: expect.toParseAsDate(createdContact.updatedAt),
            },
            newRecord: {
                ...updatedContact,
                createdAt: expect.toParseAsDate(updatedContact.createdAt),
                updatedAt: expect.toParseAsDate(updatedContact.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const contactAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedContactAudits()));
        expect(contactAudits).toHaveLength(2);
        expect(contactAudits[1]).toMatchObject(expectedAudit);
        createdContact = updatedContact;
    });
    test('DELETE audit', async () => {
        const deletedContact = await dbConnection_1.db.task(t => t.none(`DELETE FROM "Contacts" WHERE id = ${createdContact.id};`));
        expect(deletedContact).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Contacts',
            operation: 'DELETE',
            oldRecord: {
                ...createdContact,
                createdAt: expect.toParseAsDate(createdContact.createdAt),
                updatedAt: expect.toParseAsDate(createdContact.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const contactAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedContactAudits()));
        expect(contactAudits).toHaveLength(3);
        expect(contactAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('Profiles_audit_trigger', () => {
    let createdProfile;
    const selectCreatedProfileAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'Profiles' AND (
      ("oldRecord"->>'id' = '${createdProfile.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'id' = '${createdProfile.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Profiles' AND (
          ("oldRecord"->>'id' = '${createdProfile.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdProfile.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Profiles" WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    test('INSERT audit', async () => {
        createdProfile = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Profiles" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy", "definitionVersion")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null, '${definitionVersion}')
        RETURNING *;
      `));
        expect(createdProfile).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Profiles',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdProfile,
                createdAt: expect.toParseAsDate(createdProfile.createdAt),
                updatedAt: expect.toParseAsDate(createdProfile.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileAudits()));
        expect(profileAudits).toHaveLength(1);
        expect(profileAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedProfile = await dbConnection_1.db.task(t => t.one(`UPDATE "Profiles" SET "name" = 'another-test' WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedProfile).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Profiles',
            operation: 'UPDATE',
            oldRecord: {
                ...createdProfile,
                createdAt: expect.toParseAsDate(createdProfile.createdAt),
                updatedAt: expect.toParseAsDate(createdProfile.updatedAt),
            },
            newRecord: {
                ...updatedProfile,
                createdAt: expect.toParseAsDate(updatedProfile.createdAt),
                updatedAt: expect.toParseAsDate(updatedProfile.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileAudits()));
        expect(profileAudits).toHaveLength(2);
        expect(profileAudits[1]).toMatchObject(expectedAudit);
        createdProfile = updatedProfile;
    });
    test('DELETE audit', async () => {
        const deletedProfile = await dbConnection_1.db.task(t => t.none(`DELETE FROM "Profiles" WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}';`));
        expect(deletedProfile).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Profiles',
            operation: 'DELETE',
            oldRecord: {
                ...createdProfile,
                createdAt: expect.toParseAsDate(createdProfile.createdAt),
                updatedAt: expect.toParseAsDate(createdProfile.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileAudits()));
        expect(profileAudits).toHaveLength(3);
        expect(profileAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('ProfilesToIdentifiers_audit_trigger', () => {
    const identifier = 'test-identifier';
    let createdProfile;
    let createdIdentifier;
    const selectCreatedProfilesToIdentifiersAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'ProfilesToIdentifiers' AND (
      ("oldRecord"->>'profileId' = '${createdProfile.id}' AND "oldRecord"->>'identifierId' = '${createdIdentifier.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'profileId' = '${createdProfile.id}' AND "newRecord"->>'identifierId' = '${createdIdentifier.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    beforeAll(async () => {
        createdProfile = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Profiles" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy", "definitionVersion")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null, '${definitionVersion}')
        RETURNING *;
      `));
        createdIdentifier = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Identifiers" ("identifier", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES ('${identifier}', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null)
        RETURNING *;
      `));
    });
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'ProfilesToIdentifiers' AND (
          ("oldRecord"->>'profileId' = '${createdProfile.id}' AND "oldRecord"->>'identifierId' = '${createdIdentifier.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'profileId' = '${createdProfile.id}' AND "newRecord"->>'identifierId' = '${createdIdentifier.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "ProfilesToIdentifiers" WHERE "profileId" = ${createdProfile.id} AND "identifierId" = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}'
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Profiles" WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}'
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Identifiers" WHERE id = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    let createdRecord;
    test('INSERT audit', async () => {
        createdRecord = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "ProfilesToIdentifiers" ("profileId", "identifierId", "accountSid", "createdAt", "updatedAt")
        VALUES (${createdProfile.id}, ${createdIdentifier.id}, '${testAccountSid}', current_timestamp, current_timestamp)
        RETURNING *;
      `));
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToIdentifiers',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToIdentifiersAudits()));
        expect(profileSectionAudits).toHaveLength(1);
        expect(profileSectionAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedRecord = await dbConnection_1.db.task(t => t.one(`UPDATE "ProfilesToIdentifiers" SET "accountSid" = '${testAccountSid}', "updatedAt" = current_timestamp WHERE "profileId" = ${createdProfile.id} AND "identifierId" = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedRecord).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToIdentifiers',
            operation: 'UPDATE',
            oldRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            newRecord: {
                ...updatedRecord,
                createdAt: expect.toParseAsDate(updatedRecord.createdAt),
                updatedAt: expect.toParseAsDate(updatedRecord.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToIdentifiersAudits()));
        expect(profileSectionAudits).toHaveLength(2);
        expect(profileSectionAudits[1]).toMatchObject(expectedAudit);
        createdRecord = updatedRecord;
    });
    test('DELETE audit', async () => {
        await dbConnection_1.db.task(t => t.none(`DELETE FROM "ProfilesToIdentifiers" WHERE "profileId" = ${createdProfile.id} AND "identifierId" = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}'`));
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToIdentifiers',
            operation: 'DELETE',
            oldRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToIdentifiersAudits()));
        expect(profileSectionAudits).toHaveLength(3);
        expect(profileSectionAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('ProfilesToProfileFlags_audit_trigger', () => {
    let createdProfile;
    let createdProfileFlag;
    const selectCreatedProfilesToProfileFlagsAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'ProfilesToProfileFlags' AND (
      ("oldRecord"->>'profileId' = '${createdProfile.id}' AND "oldRecord"->>'profileFlagId' = '${createdProfileFlag.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'profileId' = '${createdProfile.id}' AND "newRecord"->>'profileFlagId' = '${createdProfileFlag.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    beforeAll(async () => {
        createdProfile = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Profiles" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy", "definitionVersion")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null, '${definitionVersion}')
        RETURNING *;
      `));
        createdProfileFlag = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "ProfileFlags" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null)
        RETURNING *;
      `));
    });
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'ProfilesToProfileFlags' AND (
          ("oldRecord"->>'profileId' = '${createdProfile.id}' AND "oldRecord"->>'profileFlagId' = '${createdProfileFlag.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'profileId' = '${createdProfile.id}' AND "newRecord"->>'profileFlagId' = '${createdProfileFlag.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "ProfilesToProfileFlags" WHERE "profileId" = ${createdProfile.id} AND "profileFlagId" = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}'
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Profiles" WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}'
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "ProfileFlags" WHERE id = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    let createdRecord;
    test('INSERT audit', async () => {
        createdRecord = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "ProfilesToProfileFlags" ("profileId", "profileFlagId", "accountSid", "createdAt", "updatedAt")
        VALUES (${createdProfile.id}, ${createdProfileFlag.id}, '${testAccountSid}', current_timestamp, current_timestamp)
        RETURNING *;
      `));
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToProfileFlags',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToProfileFlagsAudits()));
        expect(profileSectionAudits).toHaveLength(1);
        expect(profileSectionAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedRecord = await dbConnection_1.db.task(t => t.one(`UPDATE "ProfilesToProfileFlags" SET "accountSid" = '${testAccountSid}', "updatedAt" = current_timestamp WHERE "profileId" = ${createdProfile.id} AND "profileFlagId" = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedRecord).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToProfileFlags',
            operation: 'UPDATE',
            oldRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            newRecord: {
                ...updatedRecord,
                createdAt: expect.toParseAsDate(updatedRecord.createdAt),
                updatedAt: expect.toParseAsDate(updatedRecord.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToProfileFlagsAudits()));
        expect(profileSectionAudits).toHaveLength(2);
        expect(profileSectionAudits[1]).toMatchObject(expectedAudit);
        createdRecord = updatedRecord;
    });
    test('DELETE audit', async () => {
        await dbConnection_1.db.task(t => t.none(`DELETE FROM "ProfilesToProfileFlags" WHERE "profileId" = ${createdProfile.id} AND "profileFlagId" = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}'`));
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfilesToProfileFlags',
            operation: 'DELETE',
            oldRecord: {
                ...createdRecord,
                createdAt: expect.toParseAsDate(createdRecord.createdAt),
                updatedAt: expect.toParseAsDate(createdRecord.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfilesToProfileFlagsAudits()));
        expect(profileSectionAudits).toHaveLength(3);
        expect(profileSectionAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('ProfileFlags_audit_trigger', () => {
    let createdProfileFlag;
    const selectCreatedProfileFlagAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'ProfileFlags' AND (
      ("oldRecord"->>'id' = '${createdProfileFlag.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'id' = '${createdProfileFlag.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'ProfileFlags' AND (
          ("oldRecord"->>'id' = '${createdProfileFlag.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdProfileFlag.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "ProfileFlags" WHERE id = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    test('INSERT audit', async () => {
        createdProfileFlag = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "ProfileFlags" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null)
        RETURNING *;
      `));
        expect(createdProfileFlag).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileFlags',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdProfileFlag,
                createdAt: expect.toParseAsDate(createdProfileFlag.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileFlag.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileFlagAudits()));
        expect(profileFlagAudits).toHaveLength(1);
        expect(profileFlagAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedProfileFlag = await dbConnection_1.db.task(t => t.one(`UPDATE "ProfileFlags" SET "name" = 'another-test' WHERE id = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedProfileFlag).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileFlags',
            operation: 'UPDATE',
            oldRecord: {
                ...createdProfileFlag,
                createdAt: expect.toParseAsDate(createdProfileFlag.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileFlag.updatedAt),
            },
            newRecord: {
                ...updatedProfileFlag,
                createdAt: expect.toParseAsDate(updatedProfileFlag.createdAt),
                updatedAt: expect.toParseAsDate(updatedProfileFlag.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileFlagAudits()));
        expect(profileFlagAudits).toHaveLength(2);
        expect(profileFlagAudits[1]).toMatchObject(expectedAudit);
        createdProfileFlag = updatedProfileFlag;
    });
    test('DELETE audit', async () => {
        const deletedProfileFlag = await dbConnection_1.db.task(t => t.none(`DELETE FROM "ProfileFlags" WHERE id = ${createdProfileFlag.id} AND "accountSid" = '${testAccountSid}';`));
        expect(deletedProfileFlag).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileFlags',
            operation: 'DELETE',
            oldRecord: {
                ...createdProfileFlag,
                createdAt: expect.toParseAsDate(createdProfileFlag.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileFlag.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileFlagAudits()));
        expect(profileFlagAudits).toHaveLength(3);
        expect(profileFlagAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('ProfileSections_audit_trigger', () => {
    let createdProfile;
    let createdProfileSection;
    const selectCreatedProfileSectionAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'ProfileSections' AND (
      ("oldRecord"->>'id' = '${createdProfileSection.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'id' = '${createdProfileSection.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    beforeAll(async () => {
        createdProfile = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Profiles" ("name", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy", "definitionVersion")
        VALUES ('test', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null, '${definitionVersion}')
        RETURNING *;
      `));
    });
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'ProfileSections' AND (
          ("oldRecord"->>'id' = '${createdProfileSection.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdProfileSection.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "ProfileSections" WHERE id = ${createdProfileSection.id} AND "accountSid" = '${testAccountSid}'
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Profiles" WHERE id = ${createdProfile.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    test('INSERT audit', async () => {
        createdProfileSection = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "ProfileSections" ("sectionType", "profileId", "content", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES ('test', ${createdProfile.id}, '{}', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', NULL)
        RETURNING *;
      `));
        expect(createdProfileSection).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileSections',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdProfileSection,
                createdAt: expect.toParseAsDate(createdProfileSection.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileSection.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileSectionAudits()));
        expect(profileSectionAudits).toHaveLength(1);
        expect(profileSectionAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedProfileSection = await dbConnection_1.db.task(t => t.one(`UPDATE "ProfileSections" SET "content" = 'test content', "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdProfileSection.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedProfileSection).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileSections',
            operation: 'UPDATE',
            oldRecord: {
                ...createdProfileSection,
                createdAt: expect.toParseAsDate(createdProfileSection.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileSection.updatedAt),
            },
            newRecord: {
                ...updatedProfileSection,
                createdAt: expect.toParseAsDate(updatedProfileSection.createdAt),
                updatedAt: expect.toParseAsDate(updatedProfileSection.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileSectionAudits()));
        expect(profileSectionAudits).toHaveLength(2);
        expect(profileSectionAudits[1]).toMatchObject(expectedAudit);
        createdProfileSection = updatedProfileSection;
    });
    test('DELETE audit', async () => {
        const deletedProfileSection = await dbConnection_1.db.task(t => t.none(`DELETE FROM "ProfileSections" WHERE id = ${createdProfileSection.id} AND "accountSid" = '${testAccountSid}';`));
        expect(deletedProfileSection).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'ProfileSections',
            operation: 'DELETE',
            oldRecord: {
                ...createdProfileSection,
                createdAt: expect.toParseAsDate(createdProfileSection.createdAt),
                updatedAt: expect.toParseAsDate(createdProfileSection.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileSectionAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedProfileSectionAudits()));
        expect(profileSectionAudits).toHaveLength(3);
        expect(profileSectionAudits[2]).toMatchObject(expectedAudit);
    });
});
describe('Identifiers_audit_trigger', () => {
    const identifier = 'test-identifier';
    let createdIdentifier;
    const selectCreatedIdentifiersAudits = () => `
    SELECT * FROM "Audits" 
    WHERE "tableName" = 'Identifiers' AND (
      ("oldRecord"->>'id' = '${createdIdentifier.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
      OR 
      ("newRecord"->>'id' = '${createdIdentifier.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
    )
    ORDER BY "timestamp_clock" ASC
  `;
    afterAll(async () => {
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Identifiers' AND (
          ("oldRecord"->>'id' = '${createdIdentifier.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdIdentifier.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `));
        await dbConnection_1.db.task(t => t.none(`
        DELETE FROM "Identifiers" WHERE id = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}'
      `));
    });
    test('INSERT audit', async () => {
        createdIdentifier = await dbConnection_1.db.task(t => t.one(`
        INSERT INTO "Identifiers" ("identifier", "accountSid", "createdAt", "updatedAt", "createdBy", "updatedBy")
        VALUES ('${identifier}', '${testAccountSid}', current_timestamp, current_timestamp, '${workerSid}', null)
        RETURNING *;
      `));
        expect(createdIdentifier).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Identifiers',
            operation: 'INSERT',
            oldRecord: null,
            newRecord: {
                ...createdIdentifier,
                createdAt: expect.toParseAsDate(createdIdentifier.createdAt),
                updatedAt: expect.toParseAsDate(createdIdentifier.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedIdentifiersAudits()));
        expect(profileFlagAudits).toHaveLength(1);
        expect(profileFlagAudits[0]).toMatchObject(expectedAudit);
    });
    test('UPDATE audit', async () => {
        const updatedIdentifier = await dbConnection_1.db.task(t => t.one(`UPDATE "Identifiers" SET "accountSid" = '${testAccountSid}', "updatedAt" = current_timestamp WHERE id = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`));
        expect(updatedIdentifier).toBeDefined();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Identifiers',
            operation: 'UPDATE',
            oldRecord: {
                ...createdIdentifier,
                createdAt: expect.toParseAsDate(createdIdentifier.createdAt),
                updatedAt: expect.toParseAsDate(createdIdentifier.updatedAt),
            },
            newRecord: {
                ...updatedIdentifier,
                createdAt: expect.toParseAsDate(updatedIdentifier.createdAt),
                updatedAt: expect.toParseAsDate(updatedIdentifier.updatedAt),
            },
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedIdentifiersAudits()));
        expect(profileFlagAudits).toHaveLength(2);
        expect(profileFlagAudits[1]).toMatchObject(expectedAudit);
        createdIdentifier = updatedIdentifier;
    });
    test('DELETE audit', async () => {
        const deletedProfileFlag = await dbConnection_1.db.task(t => t.none(`DELETE FROM "Identifiers" WHERE id = ${createdIdentifier.id} AND "accountSid" = '${testAccountSid}';`));
        expect(deletedProfileFlag).toBeNull();
        const expectedAudit = {
            id: expect.any(Number),
            user: 'hrm',
            tableName: 'Identifiers',
            operation: 'DELETE',
            oldRecord: {
                ...createdIdentifier,
                createdAt: expect.toParseAsDate(createdIdentifier.createdAt),
                updatedAt: expect.toParseAsDate(createdIdentifier.updatedAt),
            },
            newRecord: null,
            timestamp_trx: expect.toParseAsDate(),
            timestamp_stm: expect.toParseAsDate(),
            timestamp_clock: expect.toParseAsDate(),
        };
        const profileFlagAudits = await dbConnection_1.db.task(t => t.manyOrNone(selectCreatedIdentifiersAudits()));
        expect(profileFlagAudits).toHaveLength(3);
        expect(profileFlagAudits[2]).toMatchObject(expectedAudit);
    });
});
