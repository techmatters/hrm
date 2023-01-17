import { performance } from 'perf_hooks';
import { db } from '../../src/connection-pool';

import * as proxiedEndpoints from '../external-service-stubs/proxied-endpoints';
import {
  appendFailedAttemptPayload,
  createContactJob,
  ContactJobType,
} from '../../src/contact-job/contact-job-data-access';

import { accountSid, contact1, workerSid } from '../mocks';
import { headers, getRequest, getServer, useOpenRules } from '../server';

useOpenRules();
const server = getServer();
const request = getRequest(server);

// eslint-disable-next-line prettier/prettier
import type { Contact } from '../../src/contact/contact-data-access';

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => {
  await proxiedEndpoints.stop();
  server.close();
});

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

    const job = await db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [contact.id]);

    const payload = "SSM parameter /development/s3/AC6a65d4fbbc731e64e1c94e9806675c3b/docs_bucket_name not found in cache";

    const promises = [...Array(100)].map(async (_, i) => {
      await appendFailedAttemptPayload(job.id, i, { test: i, payload });
    });

    const start = performance.now();
    await Promise.all(promises);
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
  });
});