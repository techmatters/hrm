import supertest from 'supertest';

import { db } from '../../src/connection-pool';

import { insertContactSql } from '../../src/contact/sql/contact-insert-sql';
import {
  appendFailedAttemptPayload,
  createContactJob,
  ContactJobType,
} from '../../src/contact-job/contact-job-data-access';

import { accountSid, contact1 } from '../mocks';
import {}

import type { Contact } from '../../src/contact/contact-data-access';


describe('appendFailedAttemptPayload', () => {
  test('appendFailedAttemptPayload should execute quickly', async () => {
    return db.tx(async connection => {
      const res = await request
        .post(route)
        .set(headers)
        .send(contact);
      const job = await createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: { id: 'test' },
        additionalPayload: undefined,
      });

      const start = performance.now();
      [...Array(100)].map(async (_, i) => {
        await appendFailedAttemptPayload(job.id, i, { test: i });
      });
      const end = performance.now();
      expect(end - start).toBeLessThan(100);
    });
  });
});
