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

import { ContactJobType } from '@tech-matters/types';
import { db } from '../../src/connection-pool';

import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import {
  createContactJob,
} from '../../src/contact-job/contact-job-data-access';

import { getById as getContactById } from '../../src/contact/contact-data-access';
import { cleanupContactJobs } from '../../src/contact-job/contact-job-cleanup';
import { completeContactJob, getContactJobById } from '../../src/contact-job/contact-job-data-access';
import { accountSid, contact1, workerSid } from '../mocks';
import { headers, getRequest, getServer, useOpenRules } from '../server';

process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';

useOpenRules();
const server = getServer();
const request = getRequest(server);

// eslint-disable-next-line prettier/prettier
import type { Contact } from '../../src/contact/contact-data-access';

beforeAll(async () => {
  process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => {
  delete process.env.TWILIO_AUTH_TOKEN;
  await mockingProxy.stop();
  server.close();
});

describe('cleanupContactJobs', () => {
  test('completed transcript job has twilio transcript removed and row deleted', async () => {
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

    let job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [contact.id]);
    job = await completeContactJob(job.id, { transcript: ['test'] });
    job = await db.oneOrNone('UPDATE "ContactJobs" SET "completed" = NULL WHERE "id" = $1 RETURNING *', [job.id]);
    // spy on twilio-client

    await cleanupContactJobs();
    job = await getContactJobById(job.id);
    expect(job).not.toBeNull();

    job = await db.oneOrNone(`UPDATE "ContactJobs" SET "completed" = (current_timestamp - interval '366 day') WHERE "id" = $1 RETURNING *`, [job.id]);

    await cleanupContactJobs();

    job = await getContactJobById(job.id);
    expect(job).toBeNull();

    const contactAfterCleanup = await getContactById(accountSid, contact.id);
    expect(contactAfterCleanup).not.toBeNull();
  });
});