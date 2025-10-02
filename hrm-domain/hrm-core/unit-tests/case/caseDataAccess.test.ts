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

import { createMockCaseInsert, createMockCaseRecord } from './mockCases';
import * as pgPromise from 'pg-promise';
import { getMockAccountDb, mockConnection, mockTask } from '../mockDb';
import * as caseDb from '../../case/caseDataAccess';
import each from 'jest-each';
import { OrderByColumn, OrderByColumnType } from '../../case/sql/caseSearchSql';
import { expectValuesInSql, getSqlStatement } from '@tech-matters/testing';
import { newTwilioUser, TwilioUser } from '@tech-matters/twilio-worker-auth';
import { AccountSID } from '@tech-matters/types';
import { rulesMap } from '../../permissions';
import { TKConditionsSets } from '../../permissions/rulesMap';
import { VALID_CASE_CREATE_FIELDS } from '../../case/caseDataAccess';
import { pick } from 'lodash';

const accountSid: AccountSID = 'ACCOUNT_SID';
const workerSid = 'WK-twilio-worker-id';
const user: TwilioUser = newTwilioUser('ACxx', 'WKxx', ['supervisor']);
let conn: pgPromise.ITask<unknown>;
const caseId = 42;

beforeEach(() => {
  conn = mockConnection();
  mockTask(conn, accountSid);
});
describe('getById', () => {
  test('get existing case returns case record matching id & account', async () => {
    const caseFromDB = createMockCaseRecord({
      id: caseId,
      helpline: 'helpline',
      status: 'open',
      info: {},
      twilioWorkerId: workerSid,
    });
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(caseFromDB);

    const result = await caseDb.getById(caseId, accountSid, user);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cases'),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).toStrictEqual(caseFromDB);
  });

  test('get non existing case returns undefined', async () => {
    const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(undefined);

    const result = await caseDb.getById(caseId, accountSid, user);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(
      expect.stringContaining('"Cases"'),
      expect.objectContaining({ accountSid, caseId }),
    );
    expect(result).not.toBeDefined();
  });
});

describe('createCase', () => {
  test('creates new record and returns created record in DB, with assigned ID.', async () => {
    const caseFromDB = createMockCaseInsert({
      helpline: 'helpline',
      status: 'open',
      twilioWorkerId: workerSid,
    });
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue({ ...caseFromDB, id: 1337 });

    const result = await caseDb.create(caseFromDB);
    const insertSql = getSqlStatement(oneSpy, -1);
    const validInsertions = pick(caseFromDB, VALID_CASE_CREATE_FIELDS);
    expectValuesInSql(insertSql, {
      ...validInsertions,
      createdAt: expect.anything(),
      updatedAt: expect.anything(),
    });
    expect(result).toStrictEqual({ ...caseFromDB, id: 1337 });
  });
});

describe('search', () => {
  const openViewPermissions = rulesMap.open.viewCase as TKConditionsSets<'case'>;
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
          sortBy: OrderByColumn.LABEL,
          sortDirection: 'ASC',
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"label" ASC NULLS LAST'],
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
          sortBy: OrderByColumn.LABEL,
        },
        expectedDbParameters: { limit: 100, offset: 25 },
        expectedInSql: ['"id" DESC', '"label" DESC NULLS LAST'],
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
        const result = await caseDb.list(
          user,
          rulesMap.open.viewCase as TKConditionsSets<'case'>,
          listConfig,
          accountSid,
          null,
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
          info: {},
          twilioWorkerId: 'WK-twilio-worker-id',
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
          info: {},
          twilioWorkerId: 'WK-twilio-worker-id',
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
      const result = await caseDb.list(
        user,
        openViewPermissions,
        listConfig,
        accountSid,
        null,
        filters,
      );
      expect(anySpy).toHaveBeenCalledWith(
        expect.stringContaining('Cases'),
        expect.objectContaining({
          ...expectedDbParameters,
          accountSid,
        }),
      );
      const statementExecuted = getSqlStatement(anySpy);
      expect(statementExecuted).toContain('Contacts');
      expect(result.count).toEqual(1337);
      expect(result.cases).toStrictEqual(expectedResult);
    },
  );
});

describe('delete', () => {
  test('returns deleted value if something at the specified ID exists to delete', async () => {
    const caseFromDB = createMockCaseRecord({});
    const oneOrNoneSpy = jest
      .spyOn(getMockAccountDb(accountSid), 'oneOrNone')
      .mockResolvedValue(caseFromDB);

    const result = await caseDb.deleteById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
      accountSid,
      caseId,
    ]);
    expect(result).toStrictEqual(caseFromDB);
  });
  test('returns nothing if nothing at the specified ID exists to delete', async () => {
    const oneOrNoneSpy = jest
      .spyOn(getMockAccountDb(accountSid), 'oneOrNone')
      .mockResolvedValue(undefined);

    const result = await caseDb.deleteById(caseId, accountSid);

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
      accountSid,
      caseId,
    ]);
    expect(result).not.toBeDefined();
  });
});
