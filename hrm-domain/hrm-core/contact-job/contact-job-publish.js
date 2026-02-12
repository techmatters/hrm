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
exports.publishDueContactJobs = exports.publishScrubTranscriptJob = exports.publishRetrieveContactTranscript = void 0;
const date_fns_1 = require("date-fns");
const client_sqs_1 = require("./client-sqs");
const types_1 = require("@tech-matters/types");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const publishRetrieveContactTranscript = (contactJob) => {
    const { accountSid, id: contactId, channelSid, serviceSid, taskId, twilioWorkerId, createdAt, } = contactJob.resource;
    const dateBasedPath = (0, date_fns_1.format)(new Date(createdAt), 'yyyy/MM/dd/yyyyMMddHHmmss');
    const filePath = `transcripts/${dateBasedPath}-${taskId}.json`;
    return (0, client_sqs_1.publishToContactJobs)({
        jobType: contactJob.jobType,
        jobId: contactJob.id,
        accountSid,
        contactId,
        channelSid,
        serviceSid,
        taskId,
        twilioWorkerId,
        filePath,
        attemptNumber: contactJob.numberOfAttempts,
        conversationMediaId: contactJob.additionalPayload.conversationMediaId,
    });
};
exports.publishRetrieveContactTranscript = publishRetrieveContactTranscript;
const publishScrubTranscriptJob = async (contactJob) => {
    const { accountSid, id: contactId, taskId, twilioWorkerId } = contactJob.resource;
    try {
        const paramVal = await (0, ssm_cache_1.getSsmParameter)(`/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/${accountSid}/jobs/contact/scrub-transcript/enabled`);
        if (paramVal?.toLowerCase() === 'true') {
            return await (0, client_sqs_1.publishToContactJobs)({
                jobType: contactJob.jobType,
                jobId: contactJob.id,
                accountSid,
                contactId,
                taskId,
                twilioWorkerId,
                attemptNumber: contactJob.numberOfAttempts,
                originalLocation: contactJob.additionalPayload.originalLocation,
            });
        }
    }
    catch (err) {
        if (!(err instanceof ssm_cache_1.SsmParameterNotFound)) {
            throw err;
        }
    }
    return;
};
exports.publishScrubTranscriptJob = publishScrubTranscriptJob;
const publishDueContactJobs = async (dueContactJobs) => {
    // console.debug(`Processing ${dueContactJobs?.length} due contact jobs.`);
    const publishedContactJobResult = await Promise.allSettled(dueContactJobs.map(async (dueJob) => {
        try {
            console.debug(`Publishing ${dueJob.jobType} job ${dueJob.id} for contact ${dueJob.contactId}.`);
            let result;
            switch (dueJob.jobType) {
                case types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
                    result = await (0, exports.publishRetrieveContactTranscript)(dueJob);
                    break;
                }
                case types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT: {
                    result = await (0, exports.publishScrubTranscriptJob)(dueJob);
                    break;
                }
                // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
                default:
                    (0, types_1.assertExhaustive)(dueJob);
            }
            console.debug(`Published ${dueJob.jobType} job ${dueJob.id} for contact ${dueJob.contactId}.`, `Published ${dueJob.jobType} job ${dueJob.id} for contact ${dueJob.contactId}.`);
            return result;
        }
        catch (err) {
            console.error(err, dueJob);
            return Promise.reject(err);
        }
    }));
    // console.debug(`Processed ${dueContactJobs?.length} due contact jobs.`);
    return publishedContactJobResult;
};
exports.publishDueContactJobs = publishDueContactJobs;
