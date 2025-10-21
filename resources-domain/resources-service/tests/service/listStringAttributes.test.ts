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

import { HrmAccountId } from '@tech-matters/types';

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { pgp } from '../../src/connection-pool';
import { clearDb } from './clearDb';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

const testReferenceAttributeValueSeed: {
  accountSid: HrmAccountId;
  resourceId: string;
  key: string;
  info: Record<string, any>;
  language: string;
  value: string;
}[] = [
  {
    accountSid: 'AC1',
    resourceId: 'baseline',
    key: 'the/key',
    value: 'path/structured/value',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    resourceId: 'baseline value, different info',
    key: 'the/key',
    value: 'path/structured/value',
    language: 'en',
    info: { different: 'info' },
  },
  {
    accountSid: 'AC1',
    key: 'the/key',
    value: 'path/structured/value',
    resourceId: 'french',
    language: 'fr',
    info: { quelques: 'infos' },
  },
  {
    accountSid: 'AC1',
    key: 'the/key',
    value: 'path/structured',
    resourceId: 'ancestor',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    key: 'the/key',
    value: 'path/structured/other-value',
    resourceId: 'other value',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    key: 'the/key',
    value: 'path/also-structured/value',
    resourceId: 'other path',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    key: 'other/key',
    value: 'path/structured/value',
    resourceId: 'other key',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC2',
    key: 'the/key',
    value: 'path/structured/value',
    resourceId: 'other account',
    language: 'en',
    info: { some: 'info' },
  },
];

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

afterAll(clearDb);

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await clearDb();
  const resourceIds = [
    ...new Set<string>(
      testReferenceAttributeValueSeed.map(s => `${s.accountSid}/${s.resourceId}`),
    ),
  ];
  const testResourceCreateSql = resourceIds
    .map(fqResourceId => {
      const [accountSid, resourceId] = fqResourceId.split('/');
      return pgp.helpers.insert(
        { id: resourceId, name: `Resource '${resourceId}'`, accountSid },
        ['accountSid', 'name', 'id'],
        { schema: 'resources', table: 'Resources' },
      );
    })
    .join(`;\n`);
  const testResourceAttributeCreateSql = testReferenceAttributeValueSeed
    .map(fieldValues =>
      pgp.helpers.insert(
        fieldValues,
        ['accountSid', 'key', 'value', 'resourceId', 'language', 'info'],
        { schema: 'resources', table: 'ResourceStringAttributes' },
      ),
    )
    .join(';\n');
  // console.log(testResourceCreateSql); // handy for debugging
  await db.multi(`${testResourceCreateSql};\n${testResourceAttributeCreateSql}`);
});

type ResultItem = { value: string; info: Record<string, any> };

describe('GET /list-string-attributes', () => {
  const basePath = '/v0/accounts/AC1/resources/list-string-attributes';

  test('No auth headers - should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(basePath);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  type TestCase = {
    description: string;
    valueStartsWith?: string;
    language?: string;
    expectedValues: ResultItem[];
    key?: string;
  };

  const testCases: TestCase[] = [
    {
      description: 'No query arguments - returns full specified list for all languages',
      expectedValues: [
        { value: 'path/structured/value', info: { some: 'info' } },
        { value: 'path/structured/value', info: { different: 'info' } },
        { value: 'path/structured/value', info: { quelques: 'infos' } },
        { value: 'path/structured/other-value', info: { some: 'info' } },
        { value: 'path/structured', info: { some: 'info' } },
        { value: 'path/also-structured/value', info: { some: 'info' } },
      ],
    },
    {
      description:
        'Language query arguments - returns full specified list for specified language only',
      language: 'en',
      expectedValues: [
        { value: 'path/structured/value', info: { some: 'info' } },
        { value: 'path/structured/value', info: { different: 'info' } },
        { value: 'path/structured/other-value', info: { some: 'info' } },
        { value: 'path/structured', info: { some: 'info' } },
        { value: 'path/also-structured/value', info: { some: 'info' } },
      ],
    },
    {
      description:
        'valueStartsWithFilter set - returns specified list with filter applied for all languages',
      valueStartsWith: 'path/structured',
      expectedValues: [
        { value: 'path/structured/value', info: { some: 'info' } },
        { value: 'path/structured/value', info: { different: 'info' } },
        { value: 'path/structured/value', info: { quelques: 'infos' } },
        { value: 'path/structured/other-value', info: { some: 'info' } },
        { value: 'path/structured', info: { some: 'info' } },
      ],
    },
    {
      description:
        'valueStartsWithFilter set with trailing slash - returns descendants only, not exact matches',
      valueStartsWith: 'path/structured/',
      expectedValues: [
        { value: 'path/structured/value', info: { some: 'info' } },
        { value: 'path/structured/value', info: { different: 'info' } },
        { value: 'path/structured/value', info: { quelques: 'infos' } },
        { value: 'path/structured/other-value', info: { some: 'info' } },
      ],
    },
    {
      description:
        'valueStartsWithFilter and language set- returns specified list with filter applied for specified language',
      valueStartsWith: 'path/structured',
      language: 'en',
      expectedValues: [
        { value: 'path/structured/value', info: { some: 'info' } },
        { value: 'path/structured/value', info: { different: 'info' } },
        { value: 'path/structured/other-value', info: { some: 'info' } },
        { value: 'path/structured', info: { some: 'info' } },
      ],
    },
    {
      description: 'key with no values associated',
      key: 'not-even-a-list',
      expectedValues: [],
    },
  ];

  each(testCases).test(
    '$description',
    async ({ valueStartsWith, language, expectedValues, key = 'the/key' }: TestCase) => {
      const queryItems = Object.entries({ valueStartsWith, language }).filter(
        ([, value]) => value,
      );
      const queryString = queryItems.map(([k, v]) => `${k}=${v}`).join('&');
      const response = await request
        .get(`${basePath}/${key}${queryString.length ? '?' : ''}${queryString}`)
        .set(headers);
      expect(response.status).toBe(200);
      expect(
        response.body.sort((a: ResultItem, b: ResultItem) =>
          `${a.value}${JSON.stringify(a.info)}`.localeCompare(
            `${b.value}${JSON.stringify(b.info)}`,
          ),
        ),
      ).toStrictEqual(
        expectedValues.sort((a, b) =>
          `${a.value}${JSON.stringify(a.info)}`.localeCompare(
            `${b.value}${JSON.stringify(b.info)}`,
          ),
        ),
      );
    },
  );
});
