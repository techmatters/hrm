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
exports.newCompletedRetrieveTranscriptMessageBody = void 0;
const dist_1 = require("@tech-matters/types/dist");
const sampleConfig_1 = require("./sampleConfig");
const newCompletedRetrieveTranscriptMessageBody = (contact, conversationMediaId, jobId) => {
    const completedRetrieveTranscriptMessage = {
        accountSid: sampleConfig_1.ACCOUNT_SID,
        attemptNumber: 0,
        attemptPayload: {
            bucket: 'docs-bucket',
            key: 'transcripts/test-transcript.txt',
        },
        attemptResult: dist_1.ContactJobAttemptResult.SUCCESS,
        contactId: parseInt(contact.id),
        jobId,
        jobType: dist_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        taskId: contact.taskId,
        twilioWorkerId: contact.twilioWorkerId,
        conversationMediaId,
        filePath: 'transcripts/test-transcript.txt',
        serviceSid: contact.serviceSid,
        channelSid: contact.channelSid,
    };
    return JSON.stringify(completedRetrieveTranscriptMessage);
};
exports.newCompletedRetrieveTranscriptMessageBody = newCompletedRetrieveTranscriptMessageBody;
