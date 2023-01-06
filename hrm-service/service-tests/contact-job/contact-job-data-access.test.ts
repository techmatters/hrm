import { performance } from 'perf_hooks';
import { db } from '../../src/connection-pool';

import * as proxiedEndpoints from '../external-service-stubs/proxied-endpoints';
import { insertContactSql } from '../../src/contact/sql/contact-insert-sql';
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
    return db.tx(async connection => {
      const res = await request
        .post(`/v0/accounts/${accountSid}/contacts`)
        .set(headers)
        .send(contact1);

      const contact = res.body as Contact;

      await createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: undefined,
      });

      //TODO: get the job

      const start = performance.now();
      [...Array(100)].map(async (_, i) => {
        // await appendFailedAttemptPayload(job.id, i, { test: i });
      });
      const end = performance.now();

      //TOOO: figure out what a reasonable time is
      expect(end - start).toBeLessThan(100);
    });
  });
});
