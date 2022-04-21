/**
 * This test suit intends to test that the audit_trigger function is set for the target tables and row operations and working as expected.
 * The shape of the json columns of each table have been simplified to avoid noise in this tests.
 */

import { db } from '../../src/connection-pool';

import '../case-validation';

const workerSid = 'worker-sid';
const anotherWorkerSid = 'another-worker-sid';
const testAccountSid = 'test-account-sid';

const selectAuditStm = (tableName: string, targetPK: string) =>
  `SELECT * FROM "Audits" WHERE "tableName" = '${tableName}' AND "targetPK" = '${targetPK}'`;

describe('Cases_audit_trigger', () => {
  let createdCase = null;

  afterAll(async () => {
    db.task(t =>
      t.none(
        `DELETE FROM "Audits" WHERE "tableName" = 'Cases' AND "targetPK" = '${createdCase.id}'`,
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
      tableName: 'Cases',
      targetPK: `${createdCase.id}`,
      operation: 'INSERT',
      updatedBy: workerSid,
      previousRecord: null,
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseAudits = await db.task(t => t.manyOrNone(selectAuditStm('Cases', createdCase.id)));

    expect(caseAudits).toHaveLength(1);

    expect(caseAudits[0]).toMatchObject(expectedAudit);
  });

  test('UPDATE audit', async () => {
    const updatedCase = await db.task(t =>
      t.one(
        `UPDATE "Cases" SET "info" = '{ "foo": 1, "bar": { "baz": "baz" } }'::jsonb, "updatedBy" = '${anotherWorkerSid}' WHERE id = ${createdCase.id} RETURNING *;`,
      ),
    );

    expect(updatedCase).toBeDefined();

    const expectedAudit = {
      id: expect.any(Number),
      tableName: 'Cases',
      targetPK: `${createdCase.id}`,
      operation: 'UPDATE',
      updatedBy: anotherWorkerSid,
      previousRecord: {
        ...createdCase,
        createdAt: expect.toParseAsDate(createdCase.createdAt),
        updatedAt: expect.toParseAsDate(updatedCase.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseAudits = await db.task(t => t.manyOrNone(selectAuditStm('Cases', createdCase.id)));

    expect(caseAudits).toHaveLength(2);

    expect(caseAudits[1]).toMatchObject(expectedAudit);

    createdCase = updatedCase;
  });

  test('DELETE audit', async () => {
    const deletedCase = await db.task(t =>
      t.none(`DELETE FROM "Cases" WHERE id = ${createdCase.id};`),
    );

    expect(deletedCase).toBeNull();

    const expectedAudit = {
      id: expect.any(Number),
      tableName: 'Cases',
      targetPK: `${createdCase.id}`,
      operation: 'DELETE',
      updatedBy: null,
      previousRecord: {
        ...createdCase,
        createdAt: expect.toParseAsDate(createdCase.createdAt),
        updatedAt: expect.toParseAsDate(createdCase.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseAudits = await db.task(t => t.manyOrNone(selectAuditStm('Cases', createdCase.id)));

    expect(caseAudits).toHaveLength(3);

    expect(caseAudits[2]).toMatchObject(expectedAudit);
  });
});

describe('CaseSections_audit_trigger', () => {
  let createdCase = null;
  let createdCaseSection = null;

  const sectionName = 'section';
  const sectionId = '123';

  const getCaseSectionPK = cs => `${cs.caseId}${cs.sectionType}${cs.sectionId}`;

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
    db.task(t =>
      t.none(
        `DELETE FROM "Audits" WHERE "tableName" = 'CaseSections' AND "targetPK" = '${getCaseSectionPK(
          createdCaseSection,
        )}'`,
      ),
    );
  });

  test('INSERT audit', async () => {
    createdCaseSection = await db.task(t =>
      t.one(`
        INSERT INTO "CaseSections" ("caseId", "sectionType", "sectionId", "createdAt", "createdBy", "updatedAt", "updatedBy", "sectionTypeSpecificData")
        VALUES (${createdCase.id}, '${sectionName}', '${sectionId}', current_timestamp, '${workerSid}', current_timestamp, '${workerSid}', '{}'::jsonb)
        RETURNING *;
      `),
    );

    expect(createdCaseSection).toBeDefined();

    const expectedAudit = {
      id: expect.any(Number),
      tableName: 'CaseSections',
      targetPK: getCaseSectionPK(createdCaseSection),
      operation: 'INSERT',
      updatedBy: workerSid,
      previousRecord: null,
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('CaseSections', getCaseSectionPK(createdCaseSection))),
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
      tableName: 'CaseSections',
      targetPK: getCaseSectionPK(updatedCaseSection),
      operation: 'UPDATE',
      updatedBy: anotherWorkerSid,
      previousRecord: {
        ...createdCaseSection,
        createdAt: expect.toParseAsDate(createdCaseSection.createdAt),
        updatedAt: expect.toParseAsDate(updatedCaseSection.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('CaseSections', getCaseSectionPK(createdCaseSection))),
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
      tableName: 'CaseSections',
      targetPK: getCaseSectionPK(createdCaseSection),
      operation: 'DELETE',
      updatedBy: null,
      previousRecord: {
        ...createdCaseSection,
        createdAt: expect.toParseAsDate(createdCaseSection.createdAt),
        updatedAt: expect.toParseAsDate(createdCaseSection.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const caseSectionAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('CaseSections', getCaseSectionPK(createdCaseSection))),
    );

    expect(caseSectionAudits).toHaveLength(3);

    expect(caseSectionAudits[2]).toMatchObject(expectedAudit);
  });
});

describe('Contacts_audit_trigger', () => {
  let createdContact = null;

  afterAll(async () => {
    db.task(t =>
      t.none(
        `DELETE FROM "Audits" WHERE "tableName" = 'Contacts' AND "targetPK" = '${createdContact.id}'`,
      ),
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
      tableName: 'Contacts',
      targetPK: `${createdContact.id}`,
      operation: 'INSERT',
      updatedBy: workerSid,
      previousRecord: null,
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const contactAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('Contacts', createdContact.id)),
    );

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
      tableName: 'Contacts',
      targetPK: `${createdContact.id}`,
      operation: 'UPDATE',
      updatedBy: anotherWorkerSid,
      previousRecord: {
        ...createdContact,
        createdAt: expect.toParseAsDate(createdContact.createdAt),
        updatedAt: expect.toParseAsDate(updatedContact.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const contactAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('Contacts', createdContact.id)),
    );

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
      tableName: 'Contacts',
      targetPK: `${createdContact.id}`,
      operation: 'DELETE',
      updatedBy: null,
      previousRecord: {
        ...createdContact,
        createdAt: expect.toParseAsDate(createdContact.createdAt),
        updatedAt: expect.toParseAsDate(createdContact.updatedAt),
      },
      timestamp_trx: expect.toParseAsDate(),
      timestamp_stm: expect.toParseAsDate(),
      timestamp_clock: expect.toParseAsDate(),
    };

    const contactAudits = await db.task(t =>
      t.manyOrNone(selectAuditStm('Contacts', createdContact.id)),
    );

    expect(contactAudits).toHaveLength(3);

    expect(contactAudits[2]).toMatchObject(expectedAudit);
  });
});
