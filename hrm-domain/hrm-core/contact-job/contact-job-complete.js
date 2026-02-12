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
exports.pollAndProcessCompletedContactJobs = exports.handleFailure = exports.handleSuccess = exports.getContactJobOrFail = exports.getAttemptNumber = exports.processCompletedContactJob = exports.processCompletedScrubContactTranscript = exports.processCompletedRetrieveContactTranscript = void 0;
const contact_job_data_access_1 = require("./contact-job-data-access");
const types_1 = require("@tech-matters/types");
const contact_job_error_1 = require("./contact-job-error");
const client_sqs_1 = require("./client-sqs");
const conversationMedia_1 = require("../conversation-media/conversationMedia");
const contactDataAccess_1 = require("../contact/contactDataAccess");
const conversationMediaDataAccess_1 = require("../conversation-media/conversationMediaDataAccess");
const contactService_1 = require("../contact/contactService");
const processCompletedRetrieveContactTranscript = async (completedJob) => {
    const conversationMedia = await (0, conversationMedia_1.getConversationMediaById)(completedJob.accountSid, completedJob.conversationMediaId);
    const storeTypeSpecificData = {
        ...conversationMedia.storeTypeSpecificData,
        location: completedJob.attemptPayload,
    };
    await (0, contactService_1.updateConversationMediaData)(completedJob.contactId?.toString())(completedJob.accountSid, completedJob.conversationMediaId, storeTypeSpecificData);
    const contact = await (0, contactDataAccess_1.getById)(completedJob.accountSid, completedJob.contactId);
    await (0, contact_job_data_access_1.createContactJob)()({
        jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: {
            originalLocation: {
                bucket: completedJob.attemptPayload.bucket,
                key: completedJob.attemptPayload.key,
            },
        },
    });
};
exports.processCompletedRetrieveContactTranscript = processCompletedRetrieveContactTranscript;
const processCompletedScrubContactTranscript = async (completedJob) => {
    const conversationMedia = await (0, conversationMediaDataAccess_1.getByContactId)(completedJob.accountSid, completedJob.contactId);
    const existingScrubbedMedia = conversationMedia.find(cm => cm.storeType == 'S3' &&
        cm.storeTypeSpecificData.type === conversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT);
    if (existingScrubbedMedia) {
        const storeTypeSpecificData = {
            ...existingScrubbedMedia.storeTypeSpecificData,
            location: completedJob.attemptPayload.scrubbedLocation,
        };
        // We don't want to reindex on a scrubbed transcript being added (yet);
        return (0, conversationMedia_1.updateConversationMediaSpecificData)(completedJob.accountSid, existingScrubbedMedia.id, storeTypeSpecificData);
    }
    else {
        return (0, conversationMedia_1.createConversationMedia)()(completedJob.accountSid, {
            contactId: completedJob.contactId,
            storeType: 'S3',
            storeTypeSpecificData: {
                type: conversationMedia_1.S3ContactMediaType.SCRUBBED_TRANSCRIPT,
                location: completedJob.attemptPayload.scrubbedLocation,
            },
        });
    }
};
exports.processCompletedScrubContactTranscript = processCompletedScrubContactTranscript;
const processCompletedContactJob = async (completedJob) => {
    switch (completedJob.jobType) {
        case types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
            return (0, exports.processCompletedRetrieveContactTranscript)(completedJob);
        }
        case types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT: {
            return (0, exports.processCompletedScrubContactTranscript)(completedJob);
        }
        default:
            (0, types_1.assertExhaustive)(completedJob);
    }
};
exports.processCompletedContactJob = processCompletedContactJob;
const getAttemptNumber = (completedJob, contactJob) => completedJob.attemptNumber ?? contactJob.numberOfAttempts;
exports.getAttemptNumber = getAttemptNumber;
const getContactJobOrFail = async (completedJob) => {
    const contactJob = await (0, contact_job_data_access_1.getContactJobById)(completedJob.jobId);
    if (!contactJob) {
        // TODO: this should probably be a fatal error that short circuits the retry logic
        throw new Error(`Could not find contact job with id ${completedJob.jobId}`);
    }
    return contactJob;
};
exports.getContactJobOrFail = getContactJobOrFail;
const handleSuccess = async (completedJob) => {
    await (0, exports.processCompletedContactJob)(completedJob);
    // Mark the job as completed
    const completionPayload = {
        message: 'Job processed successfully',
        value: completedJob.attemptPayload,
    };
    return (0, contact_job_data_access_1.completeContactJob)({
        id: completedJob.jobId,
        completionPayload,
    });
};
exports.handleSuccess = handleSuccess;
const handleFailure = async (completedJob, jobMaxAttempts) => {
    const { jobId, contactId, accountSid, jobType } = completedJob;
    let { attemptPayload } = completedJob;
    if (typeof attemptPayload !== 'string') {
        attemptPayload = "Message did not contain attemptPayload. Likely DLQ'd from lambda";
    }
    // emit an error to pick up in metrics since completed queue is our
    // DLQ. These may be duplicates of ContactJobProcessorErrors that have
    // already caused an alarm, but there is a chance of other errors ending up here.
    console.error(new contact_job_error_1.ContactJobCompleteProcessorError(`process job with id ${jobId} failed`, attemptPayload));
    const contactJob = await (0, exports.getContactJobOrFail)(completedJob);
    const attemptNumber = (0, exports.getAttemptNumber)(completedJob, contactJob);
    const updated = await (0, contact_job_data_access_1.appendFailedAttemptPayload)(jobId, attemptNumber, attemptPayload);
    if (attemptNumber >= jobMaxAttempts) {
        const completionPayload = { message: 'Attempts limit reached' };
        // This log is used to drive monitoring and alarms. Do not remove or update without reviewing the alarms.
        console.error(`${jobType} job abandoned after ${jobMaxAttempts} attempts: ${jobId}, contact ${accountSid}/${contactId}`, attemptPayload);
        return (0, contact_job_data_access_1.completeContactJob)({
            id: completedJob.jobId,
            completionPayload,
            wasSuccessful: false,
        });
    }
    return updated;
};
exports.handleFailure = handleFailure;
const pollAndProcessCompletedContactJobs = async (jobMaxAttempts) => {
    console.debug(`Checking for queued completed jobs to process`);
    const polledCompletedJobs = await (0, client_sqs_1.pollCompletedContactJobsFromQueue)();
    if (!polledCompletedJobs?.Messages)
        return;
    const { Messages: messages } = polledCompletedJobs;
    if (!Array.isArray(messages)) {
        throw new contact_job_error_1.ContactJobPollerError(`polledCompletedJobs returned invalid messages format ${messages}`);
    }
    console.debug(`[contact-job] Processing ${messages.length} completed jobs`);
    const completedJobs = await Promise.allSettled(messages.map(async (m) => {
        try {
            // Immediately handle the message deletion in case of error since poller
            // is responsible for retrying failed jobs.
            await (0, client_sqs_1.deleteCompletedContactJobsFromQueue)(m.ReceiptHandle);
            const completedJob = JSON.parse(m.Body);
            if (completedJob.attemptResult === types_1.ContactJobAttemptResult.SUCCESS) {
                console.debug(`[contact-job](${completedJob.accountSid}) Processing successful job ${completedJob.jobType} / ${completedJob.jobId}, contact ${completedJob.contactId}`, completedJob);
                const jobRecord = await (0, exports.handleSuccess)(completedJob);
                console.info(`[contact-job](${completedJob.accountSid}) Processed successful job ${completedJob.jobType} / ${completedJob.jobId}, contact ${completedJob.contactId}`, completedJob);
                return jobRecord;
            }
            else {
                console.debug(`[contact-job](${completedJob.accountSid}) Processing failed job ${completedJob.jobType} / ${completedJob.jobId}, contact ${completedJob.contactId}`, completedJob);
                return await (0, exports.handleFailure)(completedJob, jobMaxAttempts);
            }
        }
        catch (err) {
            console.error(new contact_job_error_1.ContactJobPollerError('Failed to process CompletedContactJobBody:'), m, err);
            return Promise.reject(err);
        }
    }));
    console.debug(`Processed ${messages.length} completed jobs`);
    return completedJobs;
};
exports.pollAndProcessCompletedContactJobs = pollAndProcessCompletedContactJobs;
