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
exports.mockEntitySnsParameters = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const testing_1 = require("@tech-matters/testing");
const mockEntitySnsParameters = async (mockttp, queueName, topicName) => {
    await (0, testing_1.mockSsmParameters)(mockttp, [
        {
            pathPattern: /.*\/queue-url-consumer$/,
            valueGenerator: () => queueName,
        },
        {
            pathPattern: /.*\/notifications-sns-topic-arn$/,
            valueGenerator: () => topicName,
        },
    ]);
};
exports.mockEntitySnsParameters = mockEntitySnsParameters;
