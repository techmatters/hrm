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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const format_1 = __importDefault(require("date-fns/format"));
const s3_client_1 = require("@tech-matters/s3-client");
const entityNotification_1 = require("./entityNotification");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const types_1 = require("@tech-matters/types");
const processRecord = async (record) => {
    try {
        const notification = JSON.parse(record.body);
        console.debug('Processing message:', record.messageId);
        const bucket = await (0, ssm_cache_1.getSsmParameter)(`/${process.env.NODE_ENV}/s3/${(0, types_1.getTwilioAccountSidFromHrmAccountId)(notification.accountSid)}/docs_bucket_name`);
        const { payload, timestamp, entityType } = (0, entityNotification_1.getNormalisedNotificationPayload)(notification);
        if (payload === null) {
            throw new Error(`No expected payload on notification: ${JSON.stringify(notification)}`);
        }
        console.debug(`Recording ${entityType} update notification, accountSid: ${notification.accountSid}, ${entityType} ID: ${payload.id}, operation: ${notification.operation}`);
        const key = `${process.env.JSON_EXPORT_DIRECTORY || 'hrm-data'}/${(0, format_1.default)(timestamp, 'yyyy/MM/dd')}/${entityType}s/${payload.id}.json`;
        let outputObject = payload;
        // Only provide ids of connected contacts in case objects
        if ((0, entityNotification_1.isCaseNotification)(notification)) {
            outputObject = {
                ...notification.case,
                connectedContacts: notification.case.connectedContacts.map(c => c.id),
            };
        }
        await (0, s3_client_1.putS3Object)({
            key,
            bucket,
            body: JSON.stringify(outputObject),
        });
        console.info(`Recorded contact update notification, accountSid: ${payload.accountSid}, ${entityType} ID: ${payload.id}, operation: ${notification.operation}, s3 location: ${bucket}/${key}`);
    }
    catch (err) {
        console.error('Failed to process sqs message', record, err);
        // bubble error to reject promise
        throw err;
    }
};
const handler = async (event) => {
    try {
        const promises = event.Records.map(async (sqsRecord) => processRecord(sqsRecord));
        const rejectedResults = (await Promise.allSettled(promises)).filter(r => r.status === 'rejected');
        return {
            batchItemFailures: rejectedResults.map((_, idx) => event.Records[idx].messageId),
        };
    }
    catch (err) {
        console.error('Failed to process sqs messages', event, err);
        // We fail all messages here because we hit
        // a fatal error before we could process any of the messages.
        const batchItemFailures = event.Records.map(record => {
            return {
                itemIdentifier: record.messageId,
            };
        });
        return { batchItemFailures };
    }
};
exports.handler = handler;
