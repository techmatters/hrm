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

import { db } from '@tech-matters/hrm-core/src/connection-pool';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { createContactJob } from '@tech-matters/hrm-core/src/contact-job/contact-job-data-access';
import {
  isS3StoredTranscriptPending,
  updateConversationMediaData,
} from '@tech-matters/hrm-core/src/conversation-media/conversation-media';
import { S3ContactMediaType } from '@tech-matters/hrm-core/src/conversation-media/conversation-media';
import { getById as getContactById } from '@tech-matters/hrm-core/src/contact/contactDataAccess';
import * as cleanupContactJobsApi from '@tech-matters/hrm-core/src/contact-job/contact-job-cleanup';
import {
  completeContactJob,
  getContactJobById,
} from '@tech-matters/hrm-core/src/contact-job/contact-job-data-access';
import { accountSid, contact1, workerSid } from '../mocks';
import { headers, getRequest, getServer, useOpenRules } from '../server';

process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';

useOpenRules();
const server = getServer();
const request = getRequest(server);

import type { Contact } from '@tech-matters/hrm-core/src/contact/contactDataAccess';

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
    `UPDATE "ContactJobs" SET "completed" = (current_timestamp - interval '366 day') WHERE "id" = $1 RETURNING *`,
    [jobId],
  );

beforeAll(async () => {
  process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';
  process.env.TWILIO_CLIENT_USE_ENV_AUTH_TOKEN = 'true';
  const client = await getClient({ accountSid });
  twilioSpy = jest.spyOn(client.chat.v2, 'services');

  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterEach(async () => {
  await db.none(`DELETE FROM "ContactJobs"`);
  await db.none(`DELETE FROM "Contacts"`);
});

afterAll(async () => {
  delete process.env.TWILIO_AUTH_TOKEN;
  await mockingProxy.stop();
  server.close();
});

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
        resource: contact,
        additionalPayload: {
          conversationMediaId: 9999,
        },
      });
    });

    let job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
      contact.id,
    ]);
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

    await db.tx(connection => {
      createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: {
          conversationMediaId: contact.conversationMedia?.find(
            isS3StoredTranscriptPending,
          )?.id!,
        },
      });
    });

    let job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
      contact.id,
    ]);

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

    await db.tx(connection => {
      createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: {
          conversationMediaId: contact.conversationMedia?.find(
            isS3StoredTranscriptPending,
          )?.id!,
        },
      });
    });

    let job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
      contact.id,
    ]);

    job = await completeContactJob({ id: job.id, completionPayload });
    job = await backDateJob(job.id);
    await updateConversationMediaData(
      accountSid,
      job.additionalPayload.conversationMediaId,
      completionPayload,
    );
    await cleanupContactJobsApi.cleanupContactJobs();

    // After complete with valid payload, cleanup should happen
    job = await getContactJobById(job.id);
    expect(job).toBeNull();
    expect(twilioSpy).toHaveBeenCalledTimes(1);

    const contactAfterCleanup = await getContactById(accountSid, contact.id);
    expect(contactAfterCleanup).not.toBeNull();
  });
});
