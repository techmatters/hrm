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
exports.setupServiceTests = exports.setupServiceTestsWithConfig = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const testing_1 = require("@tech-matters/testing");
const server_1 = require("./server");
const dbCleanup_1 = require("./dbCleanup");
const sqs_1 = require("./sqs");
const ssm_1 = require("./ssm");
const mocks_1 = require("./mocks");
const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';
const ENTITY_SNS_TOPIC_NAME = 'mock-entity-sns-topic';
const setupServiceTestsWithConfig = ({ userTwilioWorkerId = mocks_1.workerSid, queues = [SEARCH_INDEX_SQS_QUEUE_NAME], serverConfig, }) => {
    const server = (0, server_1.getServer)(serverConfig);
    const request = (0, server_1.getRequest)(server);
    const internalServer = (0, server_1.getInternalServer)();
    const internalRequest = (0, server_1.getRequest)(internalServer);
    beforeAll(async () => {
        const mockttp = await testing_1.mockingProxy.mockttpServer();
        await (0, dbCleanup_1.clearAllTables)();
        await testing_1.mockingProxy.start();
        await (0, testing_1.mockSsmParameters)(mockttp);
        await (0, ssm_1.mockEntitySnsParameters)(mockttp, SEARCH_INDEX_SQS_QUEUE_NAME, ENTITY_SNS_TOPIC_NAME);
        await (0, testing_1.mockAllSns)(mockttp);
    });
    afterAll(async () => {
        await Promise.all([testing_1.mockingProxy.stop(), server.close()]);
    });
    beforeEach(async () => {
        await (0, testing_1.mockSuccessfulTwilioAuthentication)(userTwilioWorkerId);
        (0, server_1.useOpenRules)();
    });
    afterEach(async () => {
        await (0, dbCleanup_1.clearAllTables)();
    });
    return {
        ...(0, sqs_1.setupTestQueues)(queues),
        server,
        request,
        internalRequest,
        internalServer,
    };
};
exports.setupServiceTestsWithConfig = setupServiceTestsWithConfig;
const setupServiceTests = (userTwilioWorkerId = mocks_1.workerSid, queues = [SEARCH_INDEX_SQS_QUEUE_NAME]) => (0, exports.setupServiceTestsWithConfig)({ userTwilioWorkerId, queues });
exports.setupServiceTests = setupServiceTests;
