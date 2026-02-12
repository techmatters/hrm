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
exports.waitForExpectedNumberOfSQSMessage = exports.waitForSQSMessage = void 0;
const sqs_client_1 = require("@tech-matters/sqs-client");
const retryable_1 = require("./retryable");
exports.waitForSQSMessage = (0, retryable_1.retryable)(async ({ queueUrl }) => {
    const result = await (0, sqs_client_1.receiveSqsMessage)({ queueUrl });
    if (!result?.Messages)
        throw new Error('No messages');
    return result;
});
exports.waitForExpectedNumberOfSQSMessage = (0, retryable_1.retryable)(async ({ queueUrl, expectedNumberOfMessages }) => {
    const result = await (0, sqs_client_1.getQueueAttributes)({
        queueUrl,
        attributes: ['ApproximateNumberOfMessages'],
    });
    const actualNumberOfMessages = parseInt(result.ApproximateNumberOfMessages);
    if (actualNumberOfMessages !== expectedNumberOfMessages)
        throw new Error(`Expected ${expectedNumberOfMessages} messages, but got ${actualNumberOfMessages}`);
    return true;
}, false);
