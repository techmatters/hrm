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
exports.generateMockMessageBody = void 0;
const types_1 = require("@tech-matters/types");
const accountSids = ['testSid1', 'testSid2'];
const generateMockMessageBody = () => {
    const accountSid = accountSids[Math.floor(Math.random() * accountSids.length)];
    return {
        jobId: Math.floor(Math.random() * 1000000),
        accountSid,
        contactId: Math.floor(Math.random() * 1000000),
        jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        filePath: `${accountSid}/testFilePath-${Math.floor(Math.random() * 1000000)}`,
        serviceSid: 'testServiceSid',
        channelSid: 'testChannelSid',
        taskId: 'testTaskId',
        twilioWorkerId: 'testTwilioWorkerId',
        conversationMediaId: Math.floor(Math.random() * 1000000),
        attemptNumber: Math.floor(Math.random() * 20),
    };
};
exports.generateMockMessageBody = generateMockMessageBody;
