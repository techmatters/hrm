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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@tech-matters/types");
const twilio_client_1 = require("@tech-matters/twilio-client");
const dbConnection_1 = require("../dbConnection");
const testing_1 = require("@tech-matters/testing");
const contact_job_data_access_1 = require("@tech-matters/hrm-core/contact-job/contact-job-data-access");
const conversationMedia_1 = require("@tech-matters/hrm-core/conversation-media/conversationMedia");
const contactDataAccess_1 = require("@tech-matters/hrm-core/contact/contactDataAccess");
const contactService_1 = require("@tech-matters/hrm-core/contact/contactService");
const cleanupContactJobsApi = __importStar(require("@tech-matters/contact-job-cleanup"));
const contact_job_data_access_2 = require("@tech-matters/hrm-core/contact-job/contact-job-data-access");
const mocks_1 = require("../mocks");
const server_1 = require("../server");
process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';
(0, server_1.useOpenRules)();
const server = (0, server_1.getServer)();
const request = (0, server_1.getRequest)(server);
const dbCleanup_1 = require("../dbCleanup");
const sqs_1 = require("../sqs");
let twilioSpy;
const completionPayload = {
    store: 'S3',
    type: conversationMedia_1.S3ContactMediaType.TRANSCRIPT,
    location: {
        bucket: 'bucket',
        key: 'key',
    },
};
const backDateJob = (jobId) => dbConnection_1.db.oneOrNone(`UPDATE "ContactJobs" SET "completed" = (current_timestamp - interval '3660 day') WHERE "id" = $1 RETURNING *`, [jobId]);
beforeAll(async () => {
    await (0, dbCleanup_1.clearAllTables)();
    process.env.TWILIO_AUTH_TOKEN = 'mockAuthToken';
    process.env.TWILIO_CLIENT_USE_ENV_AUTH_TOKEN = 'true';
    const client = await (0, twilio_client_1.getClient)({ accountSid: mocks_1.accountSid });
    twilioSpy = jest.spyOn(client.conversations.v1.conversations, 'get');
    await testing_1.mockingProxy.start();
    const mockttp = await testing_1.mockingProxy.mockttpServer();
    await (0, testing_1.mockSuccessfulTwilioAuthentication)(mocks_1.workerSid);
    await (0, testing_1.mockSsmParameters)(mockttp, [
        {
            pathPattern: /.*\/queue-url-consumer$/,
            valueGenerator: () => 'mock-queue',
        },
    ]);
});
afterEach(async () => {
    await (0, dbCleanup_1.clearAllTables)();
});
afterAll(async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    await testing_1.mockingProxy.stop();
    server.close();
});
(0, sqs_1.setupTestQueues)(['mock-queue']);
describe('cleanupContactJobs', () => {
    test('transcript job that is complete but not old enough will not be cleaned', async () => {
        const res = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts`)
            .set(server_1.headers)
            .send({
            ...mocks_1.contact1,
        });
        const contact = res.body;
        await dbConnection_1.db.tx(connection => {
            (0, contact_job_data_access_1.createContactJob)(connection)({
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                resource: { ...contact, id: parseInt(contact.id) },
                additionalPayload: {
                    conversationMediaId: 9999,
                },
            });
        });
        const jobs = await dbConnection_1.db.manyOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [contact.id]);
        expect(jobs).toHaveLength(1);
        let [job] = jobs;
        job = await (0, contact_job_data_access_2.completeContactJob)({ id: job.id, completionPayload });
        job = await dbConnection_1.db.oneOrNone('UPDATE "ContactJobs" SET "completed" = NULL WHERE "id" = $1 RETURNING *', [job.id]);
        await cleanupContactJobsApi.cleanupContactJobs();
        job = await (0, contact_job_data_access_2.getContactJobById)(job.id);
        // Before complete, cleanup shouldn't happen
        expect(job).not.toBeNull();
        expect(twilioSpy).not.toHaveBeenCalled();
    });
    test('transcript job that is complete and old enough but does not have media will not be deleted ', async () => {
        const res = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts`)
            .set(server_1.headers)
            .send(mocks_1.contact1);
        const mediaAddRes = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts/${res.body.id}/conversationMedia`)
            .set(server_1.headers)
            .send([
            {
                storeType: 'S3',
                storeTypeSpecificData: {
                    type: conversationMedia_1.S3ContactMediaType.TRANSCRIPT,
                },
            },
        ]);
        const contact = mediaAddRes.body;
        const jobs = await dbConnection_1.db.manyOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [contact.id]);
        expect(jobs).toHaveLength(1);
        let [job] = jobs;
        job = await (0, contact_job_data_access_2.completeContactJob)({ id: job.id, completionPayload });
        job = await backDateJob(job.id);
        await cleanupContactJobsApi.cleanupContactJobs();
        // No conversationMedia, cleanup shouldn't happen
        expect(job).not.toBeNull();
        expect(twilioSpy).not.toHaveBeenCalled();
    });
    test('transcript job that is complete, old enough, and has media will be deleted', async () => {
        const res = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts`)
            .set(server_1.headers)
            .send(mocks_1.contact1);
        const mediaAddRes = await request
            .post(`/v0/accounts/${mocks_1.accountSid}/contacts/${res.body.id}/conversationMedia`)
            .set(server_1.headers)
            .send([
            {
                storeType: 'S3',
                storeTypeSpecificData: {
                    type: conversationMedia_1.S3ContactMediaType.TRANSCRIPT,
                },
            },
        ]);
        const contact = mediaAddRes.body;
        let job = await dbConnection_1.db.oneOrNone('SELECT * FROM "ContactJobs" WHERE "contactId" = $1', [
            contact.id,
        ]);
        job = await (0, contact_job_data_access_2.completeContactJob)({ id: job.id, completionPayload });
        job = await backDateJob(job.id);
        await (0, contactService_1.updateConversationMediaData)(contact.id)(mocks_1.accountSid, job.additionalPayload.conversationMediaId, completionPayload);
        await cleanupContactJobsApi.cleanupContactJobs();
        // After complete with valid payload, cleanup should happen
        job = await (0, contact_job_data_access_2.getContactJobById)(job.id);
        expect(job).toBeNull();
        expect(twilioSpy).toHaveBeenCalledTimes(1);
        const contactAfterCleanup = await (0, contactDataAccess_1.getById)(mocks_1.accountSid, parseInt(contact.id));
        expect(contactAfterCleanup).not.toBeNull();
    });
});
