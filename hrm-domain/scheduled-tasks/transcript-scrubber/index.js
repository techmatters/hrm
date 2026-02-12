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
exports.executeTask = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const s3_client_1 = require("@tech-matters/s3-client");
const sqs_client_1 = require("@tech-matters/sqs-client");
const types_1 = require("@tech-matters/types");
const PENDING_TRANSCRIPT_SQS_QUEUE_URL = process.env.PENDING_TRANSCRIPT_SQS_QUEUE_URL;
const COMPLETED_TRANSCRIPT_SQS_QUEUE_URL = process.env.COMPLETED_TRANSCRIPT_SQS_QUEUE_URL;
const LOCAL_PRIVATEAI_URI_ENDPOINT = new URL('http://localhost:8080/process/text');
const LOCAL_PRIVATEAI_HEALTH_ENDPOINT = new URL('http://localhost:8080/healthz');
const MAX_PAI_STARTUP_TIME_MILLIS = 10 * 60 * 1000;
const MAX_PROCESSING_RUN_TIME_MILLIS = 15 * 60 * 1000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const waitForPrivateAiToBeReady = async () => {
    let isReady = false;
    let timeoutTime = Date.now() + MAX_PAI_STARTUP_TIME_MILLIS;
    while (!isReady) {
        const response = await fetch(LOCAL_PRIVATEAI_HEALTH_ENDPOINT).catch(() => {
            return { ok: false };
        });
        if (response.ok) {
            isReady = true;
        }
        if (Date.now() > timeoutTime) {
            throw new Error('Private AI did not start in time');
        }
        console.debug(`Waiting for ${Math.round((Date.now() - timeoutTime) / 1000)} more seconds for Private AI to be ready...`);
        await delay(5000);
    }
};
const scrubS3Transcript = async (bucket, key) => {
    const transcriptS3ObjectText = await (0, s3_client_1.getS3Object)({
        bucket,
        key,
    });
    const { transcript, ...restOfDoc } = JSON.parse(transcriptS3ObjectText);
    const response = await fetch(LOCAL_PRIVATEAI_URI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: transcript.messages.map(m => m.body?.toString() ?? ''),
        }),
    });
    const responsePayload = await response.json();
    console.debug('Response from PrivateAI:', response.status);
    const results = responsePayload;
    const scrubbedKey = key.replace('transcripts', 'scrubbed-transcripts');
    const scrubbedMessages = transcript.messages.map((m, idx) => ({
        ...m,
        body: results[idx].processed_text,
    }));
    const scrubbedTranscriptJson = JSON.stringify({ ...restOfDoc, transcript: { ...transcript, messages: scrubbedMessages } }, null, 2);
    console.debug('Saving', scrubbedKey);
    await (0, s3_client_1.putS3Object)({
        bucket,
        key: scrubbedKey,
        body: scrubbedTranscriptJson,
    });
    return scrubbedKey;
};
const pollQueue = async () => {
    console.info('Polling queue', PENDING_TRANSCRIPT_SQS_QUEUE_URL);
    const messagesPayload = await (0, sqs_client_1.receiveSqsMessage)({
        queueUrl: PENDING_TRANSCRIPT_SQS_QUEUE_URL,
    });
    const messages = Array.isArray(messagesPayload?.Messages)
        ? messagesPayload?.Messages
        : [];
    let moreToProcess = false;
    for (const message of messages) {
        moreToProcess = true;
        let parsedPendingMessage;
        // ECS tasks need to manually delete the message, unlike lambdas where deletion is automically handled for SQS inputs
        // Delete it first because polling handles retries
        await (0, sqs_client_1.deleteSqsMessage)({
            queueUrl: PENDING_TRANSCRIPT_SQS_QUEUE_URL,
            receiptHandle: message.ReceiptHandle,
        });
        try {
            parsedPendingMessage = JSON.parse(message.Body);
            const { jobId, contactId, accountSid, attemptNumber, originalLocation: { bucket, key }, } = parsedPendingMessage;
            console.debug(`Scrubbing transcript: ${key} jobId: ${jobId} (attempt ${attemptNumber}), contact ${accountSid}/${contactId}`);
            const scrubbedKey = await scrubS3Transcript(bucket, key);
            await (0, sqs_client_1.sendSqsMessage)({
                queueUrl: COMPLETED_TRANSCRIPT_SQS_QUEUE_URL,
                message: JSON.stringify({
                    ...parsedPendingMessage,
                    attemptPayload: {
                        scrubbedLocation: { key: scrubbedKey, bucket },
                    },
                    attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
                }),
            });
            console.info(`Successfully scrubbed transcript: ${key}, scrubbed version at ${scrubbedKey}${key}, jobId: ${jobId} (attempt ${attemptNumber}), contact ${accountSid}/${contactId}`);
        }
        catch (error) {
            console.error(`Failed to scrub transcript`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await (0, sqs_client_1.sendSqsMessage)({
                queueUrl: COMPLETED_TRANSCRIPT_SQS_QUEUE_URL,
                message: JSON.stringify({
                    ...parsedPendingMessage,
                    attemptPayload: errorMessage,
                    attemptResult: types_1.ContactJobAttemptResult.FAILURE,
                }),
            });
        }
    }
    return moreToProcess;
};
const executeTask = async () => {
    const processingLatestFinishTime = Date.now() + MAX_PROCESSING_RUN_TIME_MILLIS;
    await waitForPrivateAiToBeReady();
    let processedMessages = 0;
    while (await pollQueue()) {
        processedMessages++;
        if (Date.now() > processingLatestFinishTime) {
            console.warn(`Could not process all the pending messages in the configured window of ${Math.round(MAX_PROCESSING_RUN_TIME_MILLIS / 1000)} seconds. If this occurs frequently you should look at options to increase the throughput of the scrubbing system.`);
            break;
        }
    }
    console.info(`Processed ${processedMessages} messages this run`);
};
exports.executeTask = executeTask;
(0, exports.executeTask)().catch(console.error);
