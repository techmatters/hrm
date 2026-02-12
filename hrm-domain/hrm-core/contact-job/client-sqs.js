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
exports.publishToContactJobs = exports.deleteCompletedContactJobsFromQueue = exports.pollCompletedContactJobsFromQueue = void 0;
const sqs_client_1 = require("@tech-matters/sqs-client");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const COMPLETED_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/sqs/jobs/hrm-contact/queue-url-complete`;
const JOB_QUEUE_SSM_PATH_BASE = `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/sqs/jobs/hrm-contact/queue-url-`;
const pollCompletedContactJobsFromQueue = async () => {
    try {
        const queueUrl = await (0, ssm_cache_1.getSsmParameter)(COMPLETED_QUEUE_SSM_PATH);
        console.debug(`[contact-job] Polling messages from SQS queue: ${queueUrl}, looked up from SSM parameter: ${COMPLETED_QUEUE_SSM_PATH}`);
        return await (0, sqs_client_1.receiveSqsMessage)({
            queueUrl,
            maxNumberOfMessages: 10,
            waitTimeSeconds: 0,
        });
    }
    catch (err) {
        console.error('Error trying to poll messages from SQS queue', err);
    }
};
exports.pollCompletedContactJobsFromQueue = pollCompletedContactJobsFromQueue;
const deleteCompletedContactJobsFromQueue = async (receiptHandle) => {
    try {
        const queueUrl = await (0, ssm_cache_1.getSsmParameter)(COMPLETED_QUEUE_SSM_PATH);
        return await (0, sqs_client_1.deleteSqsMessage)({
            queueUrl,
            receiptHandle,
        });
    }
    catch (err) {
        console.error('Error trying to delete message from SQS queue', err);
    }
};
exports.deleteCompletedContactJobsFromQueue = deleteCompletedContactJobsFromQueue;
const publishToContactJobs = async (params) => {
    //TODO: more robust error handling/messaging
    try {
        const queueUrl = await (0, ssm_cache_1.getSsmParameter)(`${JOB_QUEUE_SSM_PATH_BASE}${params.jobType}`);
        const result = await (0, sqs_client_1.sendSqsMessage)({
            queueUrl,
            message: JSON.stringify(params),
        });
        console.info(`[contact-job](${params.accountSid}) Sent job ${params.jobType} / ${params.jobId}, contact ${params.contactId}`);
        return result;
    }
    catch (err) {
        if (err instanceof ssm_cache_1.SsmParameterNotFound) {
            console.warn(`[contact-job](${params.accountSid}) SSM parameter for ${params.jobType} not found, assuming this job type is not enabled for this environment. Job ${params.jobType} / ${params.jobId}, contact ${params.contactId}`);
            return;
        }
        console.error(`[contact-job](${params?.accountSid}) Error trying to send message to SQS queue. Job ${params?.jobType} / ${params?.jobId}, contact ${params?.contactId}`, err);
    }
};
exports.publishToContactJobs = publishToContactJobs;
