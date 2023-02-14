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

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import * as mocks from './mocks';
import { db } from '../src/connection-pool';
import { headers, getRequest, getServer, useOpenRules } from './server';
import { addSeconds, subHours } from 'date-fns';
import { contact1, contact2 } from './mocks';
import { Referral } from '../src/referral/referral-data-access';
import each from 'jest-each';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { accountSid, workerSid } = mocks;

const clearDownDb = async () =>
  db.task(t =>
    t.none(
      `
      DELETE FROM "Contacts" WHERE "accountSid" = $<accountSid>;
    `,
      { accountSid },
    ),
  );

const referralExistsInDb = async (referral: Referral) => {
  const record = await db.task(conn =>
    conn.oneOrNone(
      `SELECT * FROM "Referrals" AS r 
              WHERE r."accountSid" = $<accountSid> 
              AND r."contactId" = $<contactId> 
              AND r."resourceId" = $<resourceId> 
              AND r."referredAt" = $<referredAt>`,
      { ...referral, accountSid },
    ),
  );
  return Boolean(record);
};

let existingContactId: string, otherExistingContactId: string;

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await clearDownDb();
});

beforeEach(async () => {
  const responses = await Promise.all([
    request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send(contact1),
    request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send(contact2),
  ]);
  [existingContactId, otherExistingContactId] = responses.map(r => r.body.id);
  console.log('Contact IDs for test:', existingContactId, otherExistingContactId);
});

afterAll(async () => Promise.all([mockingProxy.stop(), clearDownDb(), server.close()]));

const route = `/v0/accounts/${accountSid}/referrals`;

describe('POST /', () => {
  const hourAgo = subHours(new Date(), 1);
  let validBody;

  beforeEach(() => {
    validBody = {
      contactId: existingContactId,
      resourceId: 'TEST_RESOURCE',
      referredAt: hourAgo.toISOString(),
      resourceName: 'A test referred resource',
    };
  });

  test('No auth headers - should return 401', async () => {
    const response = await request.post(route).send(validBody);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authorization failed');
  });

  test('Contact ID exists - creates referral and returns it back', async () => {
    const response = await request
      .post(route)
      .set(headers)
      .send(validBody);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(validBody);
    expect(await referralExistsInDb(validBody)).toBe(true);
  });

  test('Contact ID does not exist - returns 404', async () => {
    const response = await request
      .post(route)
      .set(headers)
      .send({ ...validBody, contactId: '-1' });

    expect(response.status).toBe(404);
    expect(await referralExistsInDb({ ...validBody, contactId: '-1' })).toBe(false);
  });

  test('Referral with same contact ID, resource ID and referredAt date already exists - return 400', async () => {
    const firstResponse = await request
      .post(route)
      .set(headers)
      .send(validBody);

    expect(firstResponse.status).toBe(200);
    expect(await referralExistsInDb(validBody)).toBe(true);

    const secondResponse = await request
      .post(route)
      .set(headers)
      .send(validBody);

    expect(secondResponse.status).toBe(400);
    expect(await referralExistsInDb(validBody)).toBe(true);
  });
  // secondBodyChanges needs to be a func otherwise otherExistingContactId is evaluated too soon.
  each([
    {
      secondBodyChanges: () => ({ referredAt: addSeconds(hourAgo, 10).toISOString() }),
      changeDescription: 'referredAt',
    },
    {
      secondBodyChanges: () => ({ contactId: otherExistingContactId }),
      changeDescription: 'contactId',
    },
    {
      secondBodyChanges: () => ({ resourceId: 'OTHER_TEST_RESOURCE' }),
      changeDescription: 'resourceId',
    },
  ]).test(
    'Referral which duplicates an existing one but with different $changeDescription creates another record',
    async ({ secondBodyChanges }) => {
      const firstResponse = await request
        .post(route)
        .set(headers)
        .send(validBody);

      expect(firstResponse.status).toBe(200);

      const secondBody = { ...validBody, ...secondBodyChanges() };
      const secondResponse = await request
        .post(route)
        .set(headers)
        .send(secondBody);
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toStrictEqual(secondBody);
      expect(await referralExistsInDb(secondBody)).toBe(true);
    },
  );
  each([
    {
      missingField: 'referredAt',
    },
    {
      missingField: 'contactId',
    },
    {
      missingField: 'resourceId',
    },
  ]).test(
    'Referral has no $missingField returns a 400',
    async ({ missingField }: { missingField: 'resourceId' | 'contactId' | 'referredAt' }) => {
      const { [missingField]: removed, ...secondBody } = validBody;
      const response = await request
        .post(route)
        .set(headers)
        .send(secondBody);

      expect(response.status).toBe(400);
    },
  );
});
