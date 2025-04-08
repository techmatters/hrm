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

import { performance } from 'perf_hooks';
import { db } from '../dbConnection';

import {
  appendFailedAttemptPayload,
  createContactJob,
} from '@tech-matters/hrm-core/contact-job/contact-job-data-access';

import { ContactJobType } from '@tech-matters/types';

import { accountSid, contact1 } from '../mocks';
import { headers } from '../server';

import type { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { setupServiceTests } from '../setupServiceTest';

const { request } = setupServiceTests();

describe('appendFailedAttemptPayload', () => {
  test('appendFailedAttemptPayload should execute quickly', async () => {
    const res = await request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send(contact1);

    const contact = res.body as Contact;

    await db.tx(connection => {
      createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: undefined,
      });
    });

    const job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
      contact.id,
    ]);

    const payload =
      'SSM parameter /development/s3/AC6a65d4fbbc731e64e1c94e9806675c3b/docs_bucket_name not found in cache';

    const promises = [...Array(100)].map(async (_, i) => {
      await appendFailedAttemptPayload(job.id, i, { test: i, payload });
    });

    const start = performance.now();
    await Promise.all(promises);
    const end = performance.now();

    expect(end - start).toBeLessThan(2000);
  });
});
