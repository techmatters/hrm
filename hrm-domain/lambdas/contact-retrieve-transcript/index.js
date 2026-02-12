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
exports.handler = exports.processRecordWithoutException = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const sqs_client_1 = require("@tech-matters/sqs-client");
const s3_client_1 = require("@tech-matters/s3-client");
const job_errors_1 = require("@tech-matters/job-errors");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const types_1 = require("@tech-matters/types");
const exportTranscript_1 = require("./exportTranscript");
const completedQueueUrl = process.env.completed_sqs_queue_url;
const hrmEnv = process.env.NODE_ENV;
// # used for ssm-cache.LoadSsmCache() call. Leaving here for now in case we need it later. (rbd Mar 9 2023)
// const ssmCacheConfigs = [
//   {
//     path: `/${hrmEnv}/twilio/`,
//     regex: /auth_token/,
//   },
//   {
//     path: `/${hrmEnv}/s3/`,
//     regex: /docs_bucket_name/,
//   },
// ];
const processRetrieveTranscriptRecord = async (message) => {
    const { accountSid: hrmAccountId, channelSid, serviceSid, contactId, taskId, twilioWorkerId, } = message;
    // This hack to get accountSid from hrmAccountId works for now, but will break if we start using different naming
    // We should either start recording the accountSid separately on the contact, or stop accessing Twilio APIs directly from the HRM domain
    const accountSid = (0, types_1.getTwilioAccountSidFromHrmAccountId)(hrmAccountId);
    if (!accountSid) {
        throw new Error(`Account sid not found, HRM account ID value passed: ${hrmAccountId}`);
    }
    const authToken = await (0, ssm_cache_1.getSsmParameter)(`/${hrmEnv}/twilio/${accountSid}/auth_token`);
    const docsBucketName = await (0, ssm_cache_1.getSsmParameter)(`/${hrmEnv}/s3/${accountSid}/docs_bucket_name`);
    if (!authToken || !docsBucketName) {
        console.log('Missing required SSM params');
        throw new Error('Missing required SSM params');
    }
    const transcript = await (0, exportTranscript_1.exportTranscript)({
        authToken,
        accountSid,
        channelSid,
        serviceSid,
    });
    const document = {
        transcript,
        accountSid,
        hrmAccountId,
        contactId,
        taskId,
        twilioWorkerId,
        serviceSid,
        channelSid,
    };
    await (0, s3_client_1.putS3Object)({
        bucket: docsBucketName,
        key: message.filePath,
        body: JSON.stringify(document),
    });
    const completedJob = {
        ...message,
        attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
        attemptPayload: {
            bucket: docsBucketName,
            key: message.filePath,
        },
    };
    await (0, sqs_client_1.sendSqsMessage)({
        queueUrl: completedQueueUrl,
        message: JSON.stringify(completedJob),
    });
};
const processRecordWithoutException = async (sqsRecord) => {
    const message = JSON.parse(sqsRecord.body);
    try {
        if (message.jobType === types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
            await processRetrieveTranscriptRecord(message);
        }
    }
    catch (err) {
        console.error(new job_errors_1.ContactJobProcessorError('Failed to process record'), err);
        const errMessage = err instanceof Error ? err.message : String(err);
        const failedJob = {
            ...message,
            attemptResult: types_1.ContactJobAttemptResult.FAILURE,
            attemptPayload: errMessage,
        };
        console.log('Sending failed job to completed queue', failedJob);
        await (0, sqs_client_1.sendSqsMessage)({
            queueUrl: completedQueueUrl,
            message: JSON.stringify(failedJob),
        });
    }
};
exports.processRecordWithoutException = processRecordWithoutException;
const respondWithError = (event, err) => {
    const response = { batchItemFailures: [] };
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.error(new job_errors_1.ContactJobProcessorError('Failed to init processor'), err);
    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. The error
    // handler, whether loop based in hrm-services or lambda based here, will
    // need to be able to handle these messages that will end up in the completed
    // queue without a completionPayload.
    response.batchItemFailures = event.Records.map(record => {
        return {
            itemIdentifier: record.messageId,
        };
    });
};
const handler = async (event) => {
    try {
        if (!completedQueueUrl) {
            return respondWithError(event, new Error('Missing completed_sqs_queue_url ENV Variable'));
        }
        if (!hrmEnv) {
            return respondWithError(event, new Error('Missing NODE_ENV ENV Variable'));
        }
        const promises = event.Records.map(async (sqsRecord) => (0, exports.processRecordWithoutException)(sqsRecord));
        await Promise.all(promises);
    }
    catch (err) {
        return respondWithError(event, err);
    }
    return { batchItemFailures: [] };
};
exports.handler = handler;
