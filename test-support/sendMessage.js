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
exports.sendMessageBatch = exports.sendMessage = void 0;
// TODO: needs to be converted to aws-sdk-v3
const aws_sdk_1 = require("aws-sdk"); // eslint-disable-line import/no-extraneous-dependencies
const cdkOutput_1 = require("../cdk/cdkOutput");
const sendMessage = async ({ lambdaName, message, messageGroupId, }) => {
    const sqs = new aws_sdk_1.SQS({
        endpoint: 'http://localhost:4566',
        region: 'us-east-1',
    });
    const lambdaOutput = (0, cdkOutput_1.getStackOutput)(lambdaName);
    const params = {
        MessageBody: JSON.stringify(message),
        QueueUrl: lambdaOutput.queueUrl,
    };
    // Localstack fifo queues don't really work so don't bother with this for now
    // see https://github.com/localstack/localstack/issues/6766
    if (messageGroupId) {
        params.MessageGroupId = messageGroupId;
    }
    return sqs.sendMessage(params).promise();
};
exports.sendMessage = sendMessage;
const sendMessageBatch = async ({ lambdaName, messages, groupIdProperty, groupIdField, }) => {
    const sqs = new aws_sdk_1.SQS({
        endpoint: 'http://localhost:4566',
        region: 'us-east-1',
    });
    const lambdaOutput = (0, cdkOutput_1.getStackOutput)(lambdaName);
    const params = {
        QueueUrl: lambdaOutput.queueUrl,
        Entries: messages.map((message, index) => {
            const param = {
                Id: index.toString(), // TODO: may neet to be uuid at some point
                MessageBody: JSON.stringify(message),
            };
            // Localstack fifo queues don't really work so don't bother with this for now
            // see https://github.com/localstack/localstack/issues/6766
            if (groupIdProperty && groupIdField) {
                param.MessageGroupId = message[groupIdProperty][groupIdField];
            }
            return param;
        }),
    };
    return sqs.sendMessageBatch(params).promise();
};
exports.sendMessageBatch = sendMessageBatch;
