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

import * as pgPromise from 'pg-promise';
import { subHours } from 'date-fns';
import { mockConnection, mockTransaction } from '../mock-db';
import { updateImportProgress, upsertImportedResource } from '../../../src/import/importDataAccess';
import { ImportApiResource } from '@tech-matters/types';
import { getSqlStatement } from '@tech-matters/testing';

let conn: pgPromise.ITask<unknown>;

const BASELINE_DATE = new Date(2012, 11, 4);

const BLANK_ATTRIBUTES: ImportApiResource['attributes'] = {
  ResourceStringAttributes: [],
  ResourceReferenceStringAttributes: [],
  ResourceBooleanAttributes: [],
  ResourceNumberAttributes: [],
  ResourceDateTimeAttributes: [],
};

beforeEach(() => {
  conn = mockConnection();
});

describe('upsertImportedResource', () => {
  test('No attributes - should run an insert', async () => {
    mockTransaction(conn);
    const noneSpy = jest.spyOn(conn, 'none').mockResolvedValue(null);
    const result = await upsertImportedResource()('AC_FAKE', {
      name: 'Test Resource',
      id: 'TEST_RESOURCE',
      attributes: BLANK_ATTRIBUTES,
      updatedAt: BASELINE_DATE.toISOString(),
    });
    const insertSql = getSqlStatement(noneSpy);
    expect(insertSql).toContain('Resources');
    expect(insertSql).toContain('TEST_RESOURCE');
    expect(insertSql).toContain('Test Resource');
    expect(insertSql).toContain(BASELINE_DATE.toISOString());
    expect(insertSql).toContain('AC_FAKE');
    expect(result).toStrictEqual({ id: 'TEST_RESOURCE', success: true });
  });
  test('Inline attributes - should run an insert per attribute', async () => {
    mockTransaction(conn);
    const noneSpy = jest.spyOn(conn, 'none').mockResolvedValue(null);
    const result = await upsertImportedResource()('AC_FAKE', {
      name: 'Test Resource',
      id: 'TEST_RESOURCE',
      attributes: {
        ...BLANK_ATTRIBUTES,
        ResourceStringAttributes: [
          {
            key: 'Test String Attribute',
            value: 'Test String Value',
            info: {},
            language: 'en-IE',
          },
        ],
        ResourceNumberAttributes: [
          {
            key: 'Test Number Attribute',
            value: 1337,
            info: {},
          },
        ],
        ResourceBooleanAttributes: [
          {
            key: 'Test Boolean Attribute',
            value: true,
            info: {},
          },
        ],
        ResourceDateTimeAttributes: [
          {
            key: 'Test DateTime Attribute',
            value: subHours(BASELINE_DATE, 1).toISOString(),
            info: {},
          },
        ],
      },
      updatedAt: BASELINE_DATE.toISOString(),
    });
    const insertSql = getSqlStatement(noneSpy);
    expect(insertSql).toContain('Resources');
    expect(insertSql).toContain('TEST_RESOURCE');
    expect(insertSql).toContain('Test Resource');
    expect(insertSql).toContain(BASELINE_DATE.toISOString());
    expect(insertSql).toContain('AC_FAKE');
    expect(insertSql).toContain('Test String Attribute');
    expect(insertSql).toContain('Test String Value');
    expect(insertSql).toContain("'en-IE'");
    expect(insertSql).toContain('Test Boolean Attribute');
    expect(insertSql).toContain('true');
    expect(insertSql).toContain('{}');
    expect(insertSql).toContain('Test Number Attribute');
    expect(insertSql).toContain('1337');
    expect(insertSql).toContain('Test DateTime Attribute');
    expect(insertSql).toContain(subHours(BASELINE_DATE, 1).toISOString());
    expect(result).toStrictEqual({ id: 'TEST_RESOURCE', success: true });
  });
  test('Reference attributes - should run an insert per attribute', async () => {
    mockTransaction(conn);
    const noneSpy = jest.spyOn(conn, 'none').mockResolvedValue(null);
    const result = await upsertImportedResource()('AC_FAKE', {
      name: 'Test Resource',
      id: 'TEST_RESOURCE',
      attributes: {
        ...BLANK_ATTRIBUTES,
        ResourceReferenceStringAttributes: [
          {
            key: 'Test Reference Attribute',
            value: 'Test Reference Value',
            language: 'en-IE',
            list: "List o' strings",
          },
        ],
      },
      updatedAt: BASELINE_DATE.toISOString(),
    });
    const insertSql = getSqlStatement(noneSpy);
    expect(insertSql).toContain('Resources');
    expect(insertSql).toContain('TEST_RESOURCE');
    expect(insertSql).toContain('Test Resource');
    expect(insertSql).toContain(BASELINE_DATE.toISOString());
    expect(insertSql).toContain('AC_FAKE');
    expect(insertSql).toContain('Test Reference Attribute');
    expect(insertSql).toContain('Test Reference Value');
    expect(insertSql).toContain("List o'' strings");
    expect(result).toStrictEqual({ id: 'TEST_RESOURCE', success: true });
  });
});

describe('updateImportProgress', () => {
  test('Should upsert progress against account key', async () => {
    mockTransaction(conn);
    const noneSpy = jest.spyOn(conn, 'none').mockResolvedValue(null);
    await updateImportProgress()('AC_FAKE', {
      fromDate: subHours(BASELINE_DATE, 12).toISOString(),
      toDate: BASELINE_DATE.toISOString(),
      total: 1234,
      lastProcessedDate: subHours(BASELINE_DATE, 6).toISOString(),
      lastProcessedId: 'TEST_RESOURCE',
    });
    const insertSql = getSqlStatement(noneSpy);
    expect(insertSql).toContain('Accounts');
    expect(insertSql).toContain('1234');
    expect(insertSql).toContain('AC_FAKE');
    expect(insertSql).toContain(BASELINE_DATE.toISOString());
    expect(insertSql).toContain(subHours(BASELINE_DATE, 12).toISOString());
    expect(insertSql).toContain(subHours(BASELINE_DATE, 6).toISOString());
  });
});
