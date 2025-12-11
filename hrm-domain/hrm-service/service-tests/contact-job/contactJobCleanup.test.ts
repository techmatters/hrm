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
import { getClient } from '@tech-matters/twilio-client';

import { db } from '../dbConnection';
import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { createContactJob } from '@tech-matters/hrm-core/contact-job/contact-job-data-access';
import { S3ContactMediaType } from '@tech-matters/hrm-core/conversation-media/conversationMedia';
import {
  ContactRecord,
  getById as getContactById,
} from '@tech-matters/hrm-core/contact/contactDataAccess';
import { updateConversationMediaData } from '@tech-matters/hrm-core/contact/contactService';
import * as cleanupContactJobsApi from '@tech-matters/contact-job-cleanup';
import {
  completeContactJob,
  getContactJobById,
} from '@tech-matters/hrm-core/contact-job/contact-job-data-access';
import { accountSid, contact1, workerSid } from '../mocks';
import { headers, getRequest, getServer, useOpenRules } from '../server';

process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';

useOpenRules();
const server = getServer();
const request = getRequest(server);

import type { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { clearAllTables } from '../dbCleanup';
import { setupTestQueues } from '../sqs';

let twilioSpy: jest.SpyInstance;

const completionPayload = {
  store: 'S3' as 'S3',
  type: S3ContactMediaType.TRANSCRIPT,
  location: {
    bucket: 'bucket',
    key: 'key',
  },
};

const backDateJob = (jobId: string) =>
  db.oneOrNone(
    `UPDATE "ContactJobs" SET "completed" = (current_timestamp - interval '3660 day') WHERE "id" = $1 RETURNING *`,
    [jobId],
  );

beforeAll(async () => {
  await clearAllTables();
  process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';
  process.env.TWILIO_CLIENT_USE_ENV_AUTH_TOKEN = 'true';
  const client = await getClient({ accountSid });
  twilioSpy = jest.spyOn(client.conversations.v1.conversations, 'get');

  await mockingProxy.start();
  const mockttp = await mockingProxy.mockttpServer();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await mockSsmParameters(mockttp, [
    {
      pathPattern: /.*\/queue-url-consumer$/,
      valueGenerator: () => 'mock-queue',
    },
  ]);
});

afterEach(async () => {
  await clearAllTables();
});

afterAll(async () => {
  delete process.env.TWILIO_AUTH_TOKEN;
  await mockingProxy.stop();
  server.close();
});

setupTestQueues(['mock-queue']);

describe('cleanupContactJobs', () => {
  test('transcript job that is complete but not old enough will not be cleaned', async () => {
    const res = await request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send({
        ...contact1,
      });

    const contact = res.body as Contact;

    await db.tx(connection => {
      createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: { ...contact, id: parseInt(contact.id) } as unknown as ContactRecord,
        additionalPayload: {
          conversationMediaId: 9999,
        },
      });
    });

    const jobs = await db.manyOrNone(
      'SELECT * FROM "ContactJobs" WHERE "contactId" = $1',
      [contact.id],
    );
    expect(jobs).toHaveLength(1);
    let [job] = jobs;
    job = await completeContactJob({ id: job.id, completionPayload });
    job = await db.oneOrNone(
      'UPDATE "ContactJobs" SET "completed" = NULL WHERE "id" = $1 RETURNING *',
      [job.id],
    );

    await cleanupContactJobsApi.cleanupContactJobs();
    job = await getContactJobById(job.id);

    // Before complete, cleanup shouldn't happen
    expect(job).not.toBeNull();
    expect(twilioSpy).not.toHaveBeenCalled();
  });

  test('transcript job that is complete and old enough but does not have media will not be deleted ', async () => {
    const res = await request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send(contact1);

    const mediaAddRes = await request
      .post(`/v0/accounts/${accountSid}/contacts/${res.body.id}/conversationMedia`)
      .set(headers)
      .send([
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
          },
        },
      ]);
    const contact = mediaAddRes.body as Contact;

    const jobs = await db.manyOrNone(
      'SELECT * FROM "ContactJobs" WHERE "contactId" = $1',
      [contact.id],
    );
    expect(jobs).toHaveLength(1);
    let [job] = jobs;

    job = await completeContactJob({ id: job.id, completionPayload });
    job = await backDateJob(job.id);
    await cleanupContactJobsApi.cleanupContactJobs();

    // No conversationMedia, cleanup shouldn't happen
    expect(job).not.toBeNull();
    expect(twilioSpy).not.toHaveBeenCalled();
  });

  test('transcript job that is complete, old enough, and has media will be deleted', async () => {
    const res = await request
      .post(`/v0/accounts/${accountSid}/contacts`)
      .set(headers)
      .send(contact1);

    const mediaAddRes = await request
      .post(`/v0/accounts/${accountSid}/contacts/${res.body.id}/conversationMedia`)
      .set(headers)
      .send([
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
          },
        },
      ]);

    const contact = mediaAddRes.body as Contact;

    let job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
      contact.id,
    ]);

    job = await completeContactJob({ id: job.id, completionPayload });
    job = await backDateJob(job.id);
    await updateConversationMediaData(contact.id)(
      accountSid,
      job.additionalPayload.conversationMediaId,
      completionPayload,
    );
    await cleanupContactJobsApi.cleanupContactJobs();

    // After complete with valid payload, cleanup should happen
    job = await getContactJobById(job.id);
    expect(job).toBeNull();
    expect(twilioSpy).toHaveBeenCalledTimes(1);

    const contactAfterCleanup = await getContactById(accountSid, parseInt(contact.id));
    expect(contactAfterCleanup).not.toBeNull();
  });
});
