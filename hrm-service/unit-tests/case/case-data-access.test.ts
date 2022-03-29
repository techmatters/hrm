import { createMockCaseInsert, createMockCaseRecord } from './mock-cases';
import * as pgPromise from 'pg-promise';
import {
  expectValuesInSql,
  getSqlStatement,
  mockConnection,
  mockTask,
  mockTransaction,
} from '../mock-pgpromise';
import * as caseDb from '../../src/case/case-data-access';
import each from 'jest-each';
import { db } from '../../src/connection-pool';
import { OrderByDirection } from '../../src/case/case-sql';

const accountSid = 'account-sid';
const workerSid = 'worker-sid';
let conn: pgPromise.ITask<unknown>;
const caseId = 42;

beforeEach(() => {
  conn = mockConnection();
});
describe('getById', () => {
  test('get existing case returns case record matching id & account', async () => {
    const caseFromDB = createMockCaseRecord({
      id: caseId,
      helpline: 'helpline',
      status: 'open',
      info: {
        counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
      },
      twilioWorkerId: 'twilio-worker-id',
    });
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(caseFromDB);

    const result = await caseDb.getById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cases'),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).toStrictEqual(caseFromDB);
  });

  test('get non existing case returns undefined', async () => {
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(undefined);

    const result = await caseDb.getById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.stringContaining('CSAMReports'),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).not.toBeDefined();
  });
});

describe('createCase', () => {
  let tx: pgPromise.ITask<unknown>;
  beforeEach(() => {
    tx = mockConnection();
    mockTransaction(conn, tx);
  });
  test('creates new record and returns created record in DB, with assigned ID.', async () => {
    const caseFromDB = createMockCaseInsert({
      helpline: 'helpline',
      status: 'open',
      info: {
        counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
      },
      twilioWorkerId: 'twilio-worker-id',
    });
    const oneSpy = jest.spyOn(tx, 'one').mockResolvedValue({ ...caseFromDB, id: 1337 });

    const result = await caseDb.create(caseFromDB, accountSid, workerSid);
    const insertSql = getSqlStatement(oneSpy);
    expectValuesInSql(insertSql, { ...caseFromDB, accountSid, twilioWorkerId: workerSid });
    expect(result).toStrictEqual({ ...caseFromDB, id: 1337 });
  });

  test('creates audit record.', async () => {
    const caseFromDB = createMockCaseInsert({});
    jest.spyOn(tx, 'one').mockResolvedValue({ ...caseFromDB, id: 1337 });
    const noneSpy = jest.spyOn(tx, 'none').mockResolvedValue(undefined);

    const result = await caseDb.create(caseFromDB, accountSid, workerSid);
    const auditSql = getSqlStatement(noneSpy);
    expect(auditSql).toContain('CaseAudits');

    expect(result).toStrictEqual({ ...caseFromDB, id: 1337 });
  });
});

describe('list', () => {
  beforeEach(() => {
    mockTask(conn);
  });
  describe('query parameters', () => {
    each([
      {
        description: 'should use a default limit and offset 0 when neither specified',
        parameters: { helpline: 'fakeHelpline' },
        expectedDbParameters: { helpline: 'fakeHelpline', limit: expect.any(Number), offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should use a specified limit and offset 0 when only limit is specified',
        parameters: { helpline: 'fakeHelpline', limit: 45 },
        expectedDbParameters: { helpline: 'fakeHelpline', limit: 45, offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description:
          'should use a default limit specified and offset when only offset is specified',
        parameters: { helpline: 'fakeHelpline', offset: 30 },
        expectedDbParameters: { helpline: 'fakeHelpline', limit: expect.any(Number), offset: 30 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should use a specified limit and offset when both are present',
        parameters: { helpline: 'fakeHelpline', limit: 45, offset: 30 },
        expectedDbParameters: { helpline: 'fakeHelpline', limit: 45, offset: 30 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should use a default limit and/or offset when either are NaN',
        parameters: { helpline: 'fakeHelpline', limit: NaN, offset: NaN },
        expectedDbParameters: { helpline: 'fakeHelpline', limit: expect.any(Number), offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: "should generate SQL without helpline filter if one isn't set",
        parameters: { limit: 100, offset: 25 },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should generate SQL with order by clause',
        parameters: {
          limit: 100,
          offset: 25,
          sortBy: 'jimmyjab',
          order: OrderByDirection.ascendingNullsLast,
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"jimmyjab" ASC NULLS LAST'],
      },
      {
        description: "should use default 'id' column for ordering if order specified but no column",
        parameters: {
          limit: 100,
          offset: 25,
          order: OrderByDirection.ascendingNullsLast,
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"id" ASC NULLS LAST,'],
      },
      {
        description: 'should use default DESC sort if only sort column is specified',
        parameters: {
          limit: 100,
          offset: 25,
          sortBy: 'jimmyjab',
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"jimmyjab" DESC'],
      },
    ]).test(
      '$description',
      async ({ parameters, expectedDbParameters, expectedInSql = [], notExpectedInSql = [] }) => {
        const dbResult = [
          { ...createMockCaseRecord({ id: 2 }), totalCount: 1337 },
          { ...createMockCaseRecord({ id: 1 }), totalCount: 1337 },
        ];
        const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
        const result = await caseDb.list(parameters, accountSid);
        expect(anySpy).toHaveBeenCalledWith(
          expect.stringContaining('Cases'),
          expect.objectContaining({ ...expectedDbParameters, accountSid }),
        );
        const sql = getSqlStatement(anySpy);
        expectedInSql.forEach(expected => {
          expect(sql).toContain(expected);
        });
        notExpectedInSql.forEach(notExpected => {
          expect(sql).not.toContain(notExpected);
        });
        expect(result.count).toEqual(1337);
        expect(result.cases).toStrictEqual(dbResult);
      },
    );
  });
  each([
    {
      description: 'should return case without contacts when a case has none connected',
      parameters: { helpline: 'fakeHelpline' },
      expectedDbParameters: { helpline: 'fakeHelpline', limit: expect.any(Number), offset: 0 },
      dbResult: [
        {
          id: caseId,
          helpline: 'helpline',
          status: 'open',
          info: {
            counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
          },
          twilioWorkerId: 'twilio-worker-id',
          totalCount: 1337,
        },
      ],
    },
    {
      description: 'should return connected contacts when a case has them',
      parameters: { helpline: 'fakeHelpline' },
      expectedDbParameters: { helpline: 'fakeHelpline', limit: expect.any(Number), offset: 0 },
      dbResult: [
        {
          id: caseId,
          helpline: 'helpline',
          status: 'open',
          info: {
            counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
          },
          twilioWorkerId: 'twilio-worker-id',
          connectedContacts: [
            {
              rawJson: {
                childInformation: { name: { firstName: 'name', lastName: 'last' } },
                caseInformation: {
                  categories: {
                    cat1: { sub1: false, sub2: true },
                    cat2: { sub2: false, sub4: false },
                  },
                },
              },
            },
          ],
          totalCount: 1337,
        },
      ],
    },
  ]).test(
    '$description',
    async ({ parameters, expectedDbParameters, dbResult, expectedResult = dbResult }) => {
      const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
      const result = await caseDb.list(parameters, accountSid);
      expect(anySpy).toHaveBeenCalledWith(
        expect.stringContaining('Cases'),
        expect.objectContaining({ ...expectedDbParameters, accountSid }),
      );
      const statementExecuted = getSqlStatement(anySpy);
      expect(statementExecuted).toContain('Contacts');
      expect(statementExecuted).toContain('CSAMReports');
      expect(result.count).toEqual(1337);
      expect(result.cases).toStrictEqual(expectedResult);
    },
  );
});

describe('update', () => {
  let tx: pgPromise.ITask<unknown>;
  const caseUpdate = {
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    },
    twilioWorkerId: 'ignored-twilio-worker-id',
    accountSid: 'NOT_USING_THIS_ONE',
  };

  beforeEach(() => {
    tx = mockConnection();
    mockTransaction(tx);
  });

  test('runs update SQL against cases table with provided ID.', async () => {
    const caseUpdateResult = createMockCaseRecord(caseUpdate);
    const multiSpy = jest
      .spyOn(tx, 'multi')
      .mockResolvedValue([
        [{ ...createMockCaseRecord({}), id: caseId }],
        [{ ...caseUpdateResult, id: caseId }],
      ]);

    const result = await caseDb.update(caseId, caseUpdate, accountSid, workerSid);
    const updateSql = getSqlStatement(multiSpy);
    expect(updateSql).toContain('Cases');
    expect(updateSql).toContain('Contacts');
    expect(updateSql).toContain('CSAMReports');
    expectValuesInSql(updateSql, { ...caseUpdate, twilioWorkerId: workerSid });
    expect(multiSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).toStrictEqual({ ...caseUpdateResult, id: caseId });
  });

  test('creates audit record if a record was updated.', async () => {
    const caseUpdateResult = {
      ...createMockCaseRecord(caseUpdate),
      id: caseId,
      accountSid,
      twilioWorkerId: workerSid,
    };
    jest
      .spyOn(tx, 'multi')
      .mockResolvedValue([[{ ...createMockCaseRecord({}), id: caseId }], [caseUpdateResult]]);
    const auditSpy = jest.spyOn(tx, 'none');

    const result = await caseDb.update(caseId, caseUpdate, accountSid, workerSid);
    const auditSql = getSqlStatement(auditSpy);
    expect(auditSql).toContain('CaseAudits');
    expectValuesInSql(auditSql, caseUpdateResult);
    expect(result).toStrictEqual(caseUpdateResult);
  });

  test('does not write an audit record if no record was updated.', async () => {
    const updateSpy = jest
      .spyOn(tx, 'multi')
      .mockResolvedValue([[{ ...createMockCaseRecord({}), id: caseId }], []]);
    const auditSpy = jest.spyOn(tx, 'none');

    await caseDb.update(caseId, caseUpdate, accountSid, workerSid);
    expect(updateSpy).toBeCalled();
    expect(auditSpy).not.toBeCalled();
  });
});

describe('delete', () => {
  test('returns deleted value if something at the specified ID exists to delete', async () => {
    const caseFromDB = createMockCaseRecord({});
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(db, 'oneOrNone').mockResolvedValue(caseFromDB);

    const result = await caseDb.deleteById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
      accountSid,
      caseId,
    ]);
    expect(result).toStrictEqual(caseFromDB);
  });
  test('returns nothing if nothing at the specified ID exists to delete', async () => {
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(db, 'oneOrNone').mockResolvedValue(undefined);

    const result = await caseDb.deleteById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
      accountSid,
      caseId,
    ]);
    expect(result).not.toBeDefined();
  });
});
