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

/**
 * This test suit intends to test that the audit_trigger function is set for the target tables and row operations and working as expected.
 * The shape of the json columns of each table have been simplified to avoid noise in this tests.
 */

import { db } from '../../src/connection-pool';

import '../caseValidation';

const workerSid = 'WK-worker-sid';
const anotherWorkerSid = 'WK-another-worker-sid';
const testAccountSid = 'test-account-sid';

describe('Cases_audit_trigger', () => {
  let createdCase = null;

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
    await db.task(t =>
      t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Cases' AND (
          ("oldRecord"->>'id' = '${createdCase.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR
          ("newRecord"->>'id' = '${createdCase.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `),
    );

    await db.task(t =>
      t.none(
        `DELETE FROM "Cases" WHERE  id = ${createdCase.id} AND "accountSid" = '${testAccountSid}'`,
      ),
    );
  });

  test('INSERT audit', async () => {
    createdCase = await db.task(t =>
      t.one(`
        INSERT INTO "Cases" ("info", helpline, status, "twilioWorkerId", "createdBy", "accountSid", "createdAt", "updatedAt", "updatedBy")
        VALUES ('{}'::jsonb, '', 'open', '${workerSid}', '${workerSid}', '${testAccountSid}', current_timestamp, current_timestamp, NULL)
        RETURNING *;
      `),
    );

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

    const caseAudits = await db.task(t => t.manyOrNone(selectCreatedCaseAudits));

    expect(caseAudits).toHaveLength(1);

    expect(caseAudits[0]).toMatchObject(expectedAudit);
  });

  test('UPDATE audit', async () => {
    const updatedCase = await db.task(t =>
      t.one(
        `UPDATE "Cases" SET "info" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdCase.id} AND "accountSid" = '${testAccountSid}' RETURNING *;`,
      ),
    );

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

    const caseAudits = await db.task(t => t.manyOrNone(selectCreatedCaseAudits));

    expect(caseAudits).toHaveLength(2);

    expect(caseAudits[1]).toMatchObject(expectedAudit);

    createdCase = updatedCase;
  });

  test('DELETE audit', async () => {
    const deletedCase = await db.task(t =>
      t.none(
        `DELETE FROM "Cases" WHERE id = ${createdCase.id} AND "accountSid" = '${testAccountSid}';`,
      ),
    );

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

    const caseAudits = await db.task(t => t.manyOrNone(selectCreatedCaseAudits));

    expect(caseAudits).toHaveLength(3);

    expect(caseAudits[2]).toMatchObject(expectedAudit);
  });
});

describe('CaseSections_audit_trigger', () => {
  let createdCase = null;
  let createdCaseSection = null;

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
    createdCase = await db.task(t =>
      t.one(`
        INSERT INTO "Cases" ("info", helpline, status, "twilioWorkerId", "createdBy", "accountSid", "createdAt", "updatedAt", "updatedBy")
        VALUES ('{}'::jsonb, '', 'open', '${workerSid}', '${workerSid}', '${testAccountSid}', current_timestamp, current_timestamp, NULL)
        RETURNING *;
      `),
    );
  });

  afterAll(async () => {
    await db.task(t =>
      t.none(
        `DELETE FROM "Audits" WHERE "tableName" = 'CaseSections' AND (
          ("oldRecord"->>'caseId' = '${createdCase.id}' AND "oldRecord"->>'sectionType' = '${sectionName}'  AND "oldRecord"->>'sectionId' = '${sectionId}')
          OR
          ("newRecord"->>'caseId' = '${createdCase.id}' AND "newRecord"->>'sectionType' = '${sectionName}'  AND "newRecord"->>'sectionId' = '${sectionId}')
        )`,
      ),
    );

    await db.task(t =>
      t.none(`
        DELETE FROM "Audits"
        WHERE "tableName" = 'Cases' AND (
          ("oldRecord"->>'id' = '${createdCase.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}' )
          OR 
          ("newRecord"->>'id' = '${createdCase.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `),
    );

    await db.task(t =>
      t.none(
        `DELETE FROM "Cases" WHERE  id = ${createdCase.id} AND "accountSid" = '${testAccountSid}'`,
      ),
    );
  });

  test('INSERT audit', async () => {
    createdCaseSection = await db.task(t =>
      t.one(`
        INSERT INTO "CaseSections" ("caseId", "sectionType", "sectionId", "createdAt", "createdBy", "updatedAt", "updatedBy", "sectionTypeSpecificData", "accountSid")
        VALUES (${createdCase.id}, '${sectionName}', '${sectionId}', current_timestamp, '${workerSid}', current_timestamp, '${workerSid}', '{}'::jsonb, '${testAccountSid}')
        RETURNING *;
      `),
    );

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
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectCreatedCaseSectionAudits()),
    );

    expect(caseSectionAudits).toHaveLength(1);

    expect(caseSectionAudits[0]).toMatchObject(expectedAudit);
  });

  test('UPDATE audit', async () => {
    const updatedCaseSection = await db.task(t =>
      t.one(`
        UPDATE "CaseSections" SET "sectionTypeSpecificData" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}'
        WHERE "caseId" = ${createdCaseSection.caseId} AND "sectionType" = '${createdCaseSection.sectionType}' AND "sectionId" = '${createdCaseSection.sectionId}'
        RETURNING *;
      `),
    );

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
      },
      newRecord: {
        ...updatedCaseSection,
        createdAt: expect.toParseAsDate(updatedCaseSection.createdAt),
        updatedAt: expect.toParseAsDate(updatedCaseSection.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectCreatedCaseSectionAudits()),
    );

    expect(caseSectionAudits).toHaveLength(2);

    expect(caseSectionAudits[1]).toMatchObject(expectedAudit);

    createdCaseSection = updatedCaseSection;
  });

  test('DELETE audit', async () => {
    const deletedCaseSection = await db.task(t =>
      t.none(`
        DELETE FROM "CaseSections"
        WHERE "caseId" = ${createdCaseSection.caseId} AND "sectionType" = '${createdCaseSection.sectionType}' AND "sectionId" = '${createdCaseSection.sectionId}';
      `),
    );

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
      },
      newRecord: null,
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectCreatedCaseSectionAudits()),
    );

    expect(caseSectionAudits).toHaveLength(3);

    expect(caseSectionAudits[2]).toMatchObject(expectedAudit);
  });
});

describe('Contacts_audit_trigger', () => {
  let createdContact = null;

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
    await db.task(t =>
      t.none(`
        DELETE FROM "Audits" 
        WHERE "tableName" = 'Contacts' AND (
          ("oldRecord"->>'id' = '${createdContact.id}' AND "oldRecord"->>'accountSid' = '${testAccountSid}')
          OR 
          ("newRecord"->>'id' = '${createdContact.id}' AND "newRecord"->>'accountSid' = '${testAccountSid}')
        )
      `),
    );

    await db.task(t =>
      t.none(`
        DELETE FROM "Contacts" WHERE id = ${createdContact.id} AND "accountSid" = '${testAccountSid}'
      `),
    );
  });

  test('INSERT audit', async () => {
    createdContact = await db.task(t =>
      t.one(`
        INSERT INTO "Contacts" ("rawJson", "helpline", "accountSid", "createdBy", "createdAt", "updatedAt", "updatedBy")
        VALUES ('{}'::jsonb, '', '${testAccountSid}', '${workerSid}', current_timestamp, current_timestamp, NULL)
        RETURNING *;
      `),
    );

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

    const contactAudits = await db.task(t => t.manyOrNone(selectCreatedContactAudits()));

    expect(contactAudits).toHaveLength(1);

    expect(contactAudits[0]).toMatchObject(expectedAudit);
  });

  test('UPDATE audit', async () => {
    const updatedContact = await db.task(t =>
      t.one(
        `UPDATE "Contacts" SET "rawJson" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdContact.id} RETURNING *;`,
      ),
    );

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

    const contactAudits = await db.task(t => t.manyOrNone(selectCreatedContactAudits()));

    expect(contactAudits).toHaveLength(2);

    expect(contactAudits[1]).toMatchObject(expectedAudit);

    createdContact = updatedContact;
  });

  test('DELETE audit', async () => {
    const deletedContact = await db.task(t =>
      t.none(`DELETE FROM "Contacts" WHERE id = ${createdContact.id};`),
    );

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

    const contactAudits = await db.task(t => t.manyOrNone(selectCreatedContactAudits()));

    expect(contactAudits).toHaveLength(3);

    expect(contactAudits[2]).toMatchObject(expectedAudit);
  });
});
