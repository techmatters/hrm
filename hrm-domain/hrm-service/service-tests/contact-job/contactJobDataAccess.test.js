"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const perf_hooks_1 = require("perf_hooks");
const dbConnection_1 = require("../dbConnection");
const contact_job_data_access_1 = require("@tech-matters/hrm-core/contact-job/contact-job-data-access");
const types_1 = require("@tech-matters/types");
const mocks_1 = require("../mocks");
const server_1 = require("../server");
const setupServiceTest_1 = require("../setupServiceTest");
const { request } = (0, setupServiceTest_1.setupServiceTests)();
describe('appendFailedAttemptPayload', () => {
    test('appendFailedAttemptPayload should execute quickly', async () => {
        const res = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts`)
            .set(server_1.headers)
            .send(mocks_1.contact1);
        const contact = res.body;
        await dbConnection_1.db.tx(connection => {
            (0, contact_job_data_access_1.createContactJob)(connection)({
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                resource: { ...contact, id: parseInt(contact.id) },
                additionalPayload: undefined,
            });
        });
        const job = await dbConnection_1.db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
            contact.id,
        ]);
        const payload = 'SSM parameter /development/s3/AC6a65d4fbbc731e64e1c94e9806675c3b/docs_bucket_name not found in cache';
        const promises = [...Array(100)].map(async (_, i) => {
            await (0, contact_job_data_access_1.appendFailedAttemptPayload)(job.id, i, { test: i, payload });
        });
        const start = perf_hooks_1.performance.now();
        await Promise.all(promises);
        const end = perf_hooks_1.performance.now();
        expect(end - start).toBeLessThan(2000);
    });
});
