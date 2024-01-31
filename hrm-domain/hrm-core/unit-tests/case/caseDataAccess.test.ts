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

import { createMockCaseInsert, createMockCaseRecord } from './mock-cases';
import * as pgPromise from 'pg-promise';
import { mockConnection, mockTask, mockTransaction } from '../mock-db';
import * as caseDb from '../../case/caseDataAccess';
import each from 'jest-each';
import { db } from '../../connection-pool';
import { OrderByColumn, OrderByColumnType } from '../../case/sql/caseSearchSql';
import { expectValuesInSql, getSqlStatement } from '@tech-matters/testing';
import { twilioUser } from '@tech-matters/twilio-worker-auth/dist';
import { AccountSID } from '@tech-matters/types';
import { rulesMap } from '../../permissions';
import { TKConditionsSets } from '../../permissions/rulesMap';

const accountSid: AccountSID = 'ACCOUNT_SID';
const workerSid = 'twilio-worker-id';
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
        counsellorNotes: [
          { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
        ],
      },
      twilioWorkerId: workerSid,
    });
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(caseFromDB);

    const result = await caseDb.getById(caseId, accountSid, workerSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cases'),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).toStrictEqual(caseFromDB);
  });

  test('get non existing case returns undefined', async () => {
    mockTask(conn);
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(undefined);

    const result = await caseDb.getById(caseId, accountSid, workerSid);

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
        counsellorNotes: [
          { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
        ],
      },
      caseSections: [
        {
          accountSid: '',
          sectionType: 'note',
          sectionId: 'NOTE_1',
          createdBy: 'contact-adder',
          createdAt: new Date(2000, 4, 21).toISOString(),
          updatedAt: undefined,
          updatedBy: undefined,
          sectionTypeSpecificData: { note: 'Child with covid-19' },
        },
      ],
      twilioWorkerId: 'twilio-worker-id',
    });
    const oneSpy = jest.spyOn(tx, 'one').mockResolvedValue({ ...caseFromDB, id: 1337 });

    const result = await caseDb.create(caseFromDB, accountSid, workerSid);
    const insertSql = getSqlStatement(oneSpy, -2);
    const { caseSections, ...caseWithoutSections } = caseFromDB;
    expectValuesInSql(insertSql, {
      ...caseWithoutSections,
      accountSid,
      createdAt: expect.anything(),
      updatedAt: expect.anything(),
    });
    const insertSectionSql = getSqlStatement(oneSpy, -1);
    expectValuesInSql(insertSectionSql, {
      ...caseSections[0],
      caseId: 1337,
    });
    expect(result).toStrictEqual({ ...caseFromDB, id: 1337 });
  });
});

describe('search', () => {
  const user = twilioUser(workerSid, []);
  const openViewPermissions = rulesMap.open.viewCase as TKConditionsSets<'case'>;

  beforeEach(() => {
    mockTask(conn);
  });
  describe('query parameters', () => {
    type TestCase = {
      description: string;
      filters?: caseDb.CaseListFilters;
      listConfig?: caseDb.CaseListConfiguration;
      expectedDbParameters: Partial<
        caseDb.BaseSearchQueryParams & caseDb.OptionalSearchQueryParams
      >;
      expectedInSql?: string[];
      notExpectedInSql?: string[];
    };

    const testCases: TestCase[] = [
      {
        description: 'should use a default limit and offset 0 when neither specified',
        filters: { helplines: ['fakeHelpline'] },
        expectedDbParameters: { limit: expect.any(Number), offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description:
          'should use a specified limit and offset 0 when only limit is specified',
        filters: { helplines: ['fakeHelpline'] },
        listConfig: { limit: '45' },
        expectedDbParameters: { limit: 45, offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description:
          'should use a default limit specified and offset when only offset is specified',
        filters: { helplines: ['fakeHelpline'] },
        listConfig: { offset: '30' },
        expectedDbParameters: { limit: expect.any(Number), offset: 30 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should use a specified limit and offset when both are present',
        filters: { helplines: ['fakeHelpline'] },
        listConfig: { limit: '45', offset: '30' },
        expectedDbParameters: { limit: 45, offset: 30 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should use a default limit and/or offset when either are NaN',
        filters: { helplines: ['fakeHelpline'] },
        listConfig: { limit: 'NaN', offset: 'NaN' },
        expectedDbParameters: { limit: expect.any(Number), offset: 0 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: "should generate SQL without helpline filter if one isn't set",
        listConfig: { limit: '100', offset: '25' },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC'],
      },
      {
        description: 'should generate SQL with order by clause',
        listConfig: {
          limit: '100',
          offset: '25',
          sortBy: OrderByColumn.CHILD_NAME,
          sortDirection: 'ASC',
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"childName" ASC NULLS LAST'],
      },
      {
        description: 'should ignore unrecognised sortBy columns',
        listConfig: {
          limit: '100',
          offset: '25',
          sortBy: 'jimmyjab' as OrderByColumnType,
          sortDirection: 'ASC',
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC'],
        notExpectedInSql: ['jimmyjab'],
      },
      {
        description:
          "should use default 'id' column for ordering if order specified but no column",
        listConfig: {
          limit: '100',
          offset: '25',
          sortDirection: 'ASC',
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"id" ASC NULLS LAST,'],
      },
      {
        description:
          'should use default DESC NULLS LAST sort if only sort column is specified',
        listConfig: {
          limit: '100',
          offset: '25',
          sortBy: OrderByColumn.CHILD_NAME,
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"childName" DESC NULLS LAST'],
      },
    ];

    each(testCases).test(
      '$description',
      async ({
        listConfig = {},
        filters = {},
        expectedDbParameters,
        expectedInSql = [],
        notExpectedInSql = [],
      }: TestCase) => {
        const dbResult = [
          { ...createMockCaseRecord({ id: 2 }), totalCount: 1337 },
          { ...createMockCaseRecord({ id: 1 }), totalCount: 1337 },
        ];
        const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
        const result = await caseDb.search(
          user,
          rulesMap.open.viewCase as TKConditionsSets<'case'>,
          listConfig,
          accountSid,
          {},
          filters,
        );
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
      filters: { helplines: ['fakeHelpline'] },
      expectedDbParameters: { limit: expect.any(Number), offset: 0 },
      dbResult: [
        {
          id: caseId,
          helpline: 'helpline',
          status: 'open',
          info: {
            counsellorNotes: [
              { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
            ],
          },
          twilioWorkerId: 'twilio-worker-id',
          totalCount: 1337,
        },
      ],
    },
    {
      description: 'should return connected contacts when a case has them',
      filters: { helplines: ['fakeHelpline'] },
      expectedDbParameters: { limit: expect.any(Number), offset: 0 },
      dbResult: [
        {
          id: caseId,
          helpline: 'helpline',
          status: 'open',
          info: {
            counsellorNotes: [
              { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
            ],
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
    async ({
      filters = {},
      listConfig = {},
      expectedDbParameters,
      dbResult,
      expectedResult = dbResult,
    }) => {
      const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
      const result = await caseDb.search(
        user,
        openViewPermissions,
        listConfig,
        accountSid,
        {},
        filters,
      );
      expect(anySpy).toHaveBeenCalledWith(
        expect.stringContaining('Cases'),
        expect.objectContaining({
          contactNumber: null,
          firstName: null,
          lastName: null,
          ...expectedDbParameters,
          accountSid,
        }),
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
    updatedBy: 'used-twilio-worker-id',
  };

  beforeEach(() => {
    tx = mockConnection();
    mockTransaction(tx);
  });

  test('runs update SQL against cases table with provided ID.', async () => {
    const caseUpdateResult = createMockCaseRecord(caseUpdate);
    const oneOrNoneSpy = jest
      .spyOn(tx, 'oneOrNone')
      .mockResolvedValue({ ...caseUpdateResult, id: caseId });
    const noneSpy = jest.spyOn(tx, 'none');
    const result = await caseDb.update(caseId, caseUpdate, accountSid, workerSid);
    const updateSql = getSqlStatement(noneSpy, 1);
    const selectSql = getSqlStatement(oneOrNoneSpy);
    expect(selectSql).toContain('Cases');
    expect(selectSql).toContain('Contacts');
    expect(selectSql).toContain('CSAMReports');
    expectValuesInSql(updateSql, { info: caseUpdate.info, status: caseUpdate.status });
    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).toStrictEqual({ ...caseUpdateResult, id: caseId });
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
