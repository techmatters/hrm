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
import { ResourceReferenceAttributeStringValue } from '../../src/referenceAttributes/referenceAttributeDataAccess';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

const testReferenceAttributeValueSeed: (ResourceReferenceAttributeStringValue & {
  accountSid: HrmAccountId;
  list: string;
})[] = [
  {
    accountSid: 'AC1',
    list: 'the/list',
    value: 'path/structured/value',
    id: 'baseline',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    list: 'the/list',
    value: 'path/structured/value',
    id: 'french',
    language: 'fr',
    info: { quelques: 'infos' },
  },
  {
    accountSid: 'AC1',
    list: 'the/list',
    value: 'path/structured',
    id: 'ancestor',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    list: 'the/list',
    value: 'path/structured/other-value',
    id: 'other value',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    list: 'the/list',
    value: 'path/also-structured/value',
    id: 'other path',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC1',
    list: 'other-list',
    value: 'path/structured/value',
    id: 'other list',
    language: 'en',
    info: { some: 'info' },
  },
  {
    accountSid: 'AC2',
    list: 'the/list',
    value: 'path/structured/value',
    id: 'other account',
    language: 'en',
    info: { some: 'info' },
  },
];

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

afterAll(async () => {
  await db.none(`
DELETE FROM resources."ResourceReferenceStringAttributeValues";
      `);
});

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await db.none(`
DELETE FROM resources."ResourceReferenceStringAttributeValues";
      `);

  const testResourceCreateSql = testReferenceAttributeValueSeed
    .map(fieldValues =>
      pgp.helpers.insert(
        fieldValues,
        ['accountSid', 'list', 'value', 'id', 'language', 'info'],
        { schema: 'resources', table: 'ResourceReferenceStringAttributeValues' },
      ),
    )
    .join(';\n');
  // console.log(testResourceCreateSql); // handy for debugging
  await db.multi(testResourceCreateSql);
});

/*
 * This function expects attributes to have been applied in a specific pattern (as defined in the beforeAll step):
 * - Each resource has a number of attributes equal to its index
 * - Even numbered attributes have 1 value, odd numbered attributes have 2 values
 * - Each value has the same info
 * - Each value has the same language
 */
const verifyReferenceAttributes = (
  expectedIds: string[],
  attributeValues: ResourceReferenceAttributeStringValue[],
) => {
  expectedIds.forEach(id => {
    const attribute = attributeValues.find(att => att.id === id);
    const seedAttribute = testReferenceAttributeValueSeed.find(att => att.id === id);
    expect(seedAttribute).toBeTruthy(); // If this fails, fix your test!
    // Redundant IF clause but it will keep typescript happy
    if (seedAttribute) {
      const { accountSid, list, ...expectedAttributes } = seedAttribute;
      expect(attribute).toMatchObject(expectedAttributes);
    }
  });
  expect(attributeValues.length).toBe(expectedIds.length);
};

describe('GET /reference-attributes/:list', () => {
  const basePath = '/v0/accounts/AC1/resources/reference-attributes';

  test('No auth headers - should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(basePath);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  type TestCase = {
    description: string;
    valueStartsWith?: string;
    language?: string;
    expectedIds: string[];
    list?: string;
  };

  const testCases: TestCase[] = [
    {
      description: 'No query arguments - returns full specified list for all languages',
      expectedIds: ['baseline', 'french', 'ancestor', 'other value', 'other path'],
    },
    {
      description:
        'Language query arguments - returns full specified list for specified language only',
      language: 'en',
      expectedIds: ['baseline', 'ancestor', 'other value', 'other path'],
    },
    {
      description:
        'Legacy URI encoded list - returns full specified list for specified language only',
      language: 'en',
      list: encodeURIComponent('the/list'),
      expectedIds: ['baseline', 'ancestor', 'other value', 'other path'],
    },
    {
      description:
        'valueStartsWithFilter set - returns specified list with filter applied for all languages',
      valueStartsWith: 'path/structured/',
      expectedIds: ['baseline', 'other value', 'french'],
    },
    {
      description:
        'valueStartsWithFilter and language set- returns specified list with filter applied for specified language',
      valueStartsWith: 'path/structured/',
      language: 'en',
      expectedIds: ['baseline', 'other value'],
    },
    {
      description: 'list with no values - returns empty list',
      list: 'not-even-a-list',
      expectedIds: [],
    },
  ];

  each(testCases).test(
    '$description',
    async ({ valueStartsWith, language, expectedIds, list = 'the/list' }: TestCase) => {
      const queryItems = Object.entries({ valueStartsWith, language }).filter(
        ([, value]) => value,
      );
      const queryString = queryItems.map(([k, v]) => `${k}=${v}`).join('&');
      const response = await request
        .get(`${basePath}/${list}${queryString.length ? '?' : ''}${queryString}`)
        .set(headers);
      console.log(response.body);
      verifyReferenceAttributes(expectedIds, response.body);
    },
  );
});
