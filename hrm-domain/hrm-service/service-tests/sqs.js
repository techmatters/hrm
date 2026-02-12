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
exports.setupTestQueues = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const sqslite_1 = __importDefault(require("sqslite"));
// eslint-disable-next-line import/no-extraneous-dependencies
const aws_sdk_1 = require("aws-sdk");
const setupTestQueues = (queueNames) => {
    const sqsService = (0, sqslite_1.default)({});
    const sqsClient = new aws_sdk_1.SQS({
        endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
    });
    beforeAll(() => sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT) }));
    afterAll(() => sqsService.close());
    beforeEach(async () => {
        await Promise.all(queueNames.map(async (queueName) => sqsClient
            .createQueue({
            QueueName: queueName,
        })
            .promise()));
    });
    afterEach(async () => {
        await Promise.allSettled(queueNames.map(async (queueName) => {
            try {
                const resp = await sqsClient
                    .getQueueUrl({
                    QueueName: queueName,
                })
                    .promise();
                const testQueueUrl = resp.QueueUrl;
                await sqsClient
                    .deleteQueue({
                    QueueUrl: testQueueUrl.toString(),
                })
                    .promise();
            }
            catch (err) {
                console.error(expect.getState().currentTestName, '\nError deleting queue', queueName, err);
            }
        }));
    });
    return {
        sqsService,
        sqsClient,
    };
};
exports.setupTestQueues = setupTestQueues;
