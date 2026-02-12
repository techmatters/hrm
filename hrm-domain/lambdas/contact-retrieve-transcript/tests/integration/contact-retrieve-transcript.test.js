"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForSQSMessage = exports.waitForS3Object = void 0;
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
const s3_client_1 = require("@tech-matters/s3-client");
const sqs_client_1 = require("@tech-matters/sqs-client");
const generateMockMessageBody_1 = require("../generateMockMessageBody");
const cdkOutput_1 = require("../../../../../cdk/cdkOutput");
const sendMessage_1 = require("../../../../../test-support/sendMessage");
/**
 * TODO: This is a super dirty proof of concept for e2e tests.
 * It needs cleanup.
 */
jest.setTimeout(60000);
const completeOutput = (0, cdkOutput_1.getStackOutput)('contact-complete');
const { queueUrl } = completeOutput;
const lambdaName = 'retrieve-transcript';
const waitForS3Object = async ({ message, retryCount = 0, }) => {
    const params = {
        bucket: 'docs-bucket',
        key: message.filePath,
    };
    let result;
    try {
        result = await (0, s3_client_1.getS3Object)(params);
    }
    catch (err) {
        if (retryCount < 60) {
            await new Promise(resolve => setTimeout(resolve, 250));
            return (0, exports.waitForS3Object)({ message, retryCount: retryCount + 1 });
        }
    }
    return result;
};
exports.waitForS3Object = waitForS3Object;
const waitForSQSMessage = async ({ retryCount = 0, } = {}) => {
    let result;
    try {
        result = await (0, sqs_client_1.receiveSqsMessage)({ queueUrl });
        if (!result?.Messages)
            throw new Error('No messages');
    }
    catch (err) {
        if (retryCount < 60) {
            await new Promise(resolve => setTimeout(resolve, 250));
            return (0, exports.waitForSQSMessage)({ retryCount: retryCount + 1 });
        }
    }
    return result;
};
exports.waitForSQSMessage = waitForSQSMessage;
describe('contact-retrieve-transcript', () => {
    beforeEach(async () => {
        await (0, sqs_client_1.purgeSqsQueue)({ queueUrl });
    });
    test('well formed message creates success message in complete queue and file in s3', async () => {
        const message = (0, generateMockMessageBody_1.generateMockMessageBody)();
        const attemptPayload = {
            bucket: 'docs-bucket',
            key: message.filePath,
        };
        const sqsResp = await (0, sendMessage_1.sendMessage)({ message, lambdaName });
        expect(sqsResp).toHaveProperty('MessageId');
        const s3Result = await (0, exports.waitForS3Object)({ message });
        expect(s3Result).toBeDefined();
        expect(JSON.parse(s3Result)).toHaveProperty('contactId');
        const sqsResult = await (0, exports.waitForSQSMessage)();
        expect(sqsResult).toBeDefined();
        expect(sqsResult).toHaveProperty('Messages');
        expect(sqsResult?.Messages).toHaveLength(1);
        const sqsMessage = sqsResult?.Messages?.[0];
        const body = JSON.parse(sqsMessage?.Body || '');
        expect(body?.attemptResult).toEqual('success');
        expect(body?.attemptPayload).toEqual(attemptPayload);
    });
    test('message with bad accountSid produces failure message in complete queue', async () => {
        const message = { ...(0, generateMockMessageBody_1.generateMockMessageBody)(), accountSid: 'badSid' };
        const sqsResp = await (0, sendMessage_1.sendMessage)({ message, lambdaName });
        expect(sqsResp).toHaveProperty('MessageId');
        const sqsResult = await (0, exports.waitForSQSMessage)();
        expect(sqsResult).toBeDefined();
        expect(sqsResult).toHaveProperty('Messages');
        expect(sqsResult?.Messages).toHaveLength(1);
        const sqsMessage = sqsResult?.Messages?.[0];
        const body = JSON.parse(sqsMessage?.Body || '');
        expect(body?.attemptResult).toEqual('failure');
        expect(body?.attemptPayload).toEqual('Parameter /local/twilio/badSid/auth_token not found.');
    });
});
