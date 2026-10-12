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

import { Contact } from '@tech-matters/hrm-types/Contact';
import {
  CompletedRetrieveContactTranscript,
  ContactJobAttemptResult,
  ContactJobType,
} from '@tech-matters/types/dist';
import { ACCOUNT_SID } from './sampleConfig';

export const newCompletedRetrieveTranscriptMessageBody = (
  contact: Contact,
  conversationMediaId: number,
  jobId: number,
): string => {
  const completedRetrieveTranscriptMessage: CompletedRetrieveContactTranscript = {
    accountSid: ACCOUNT_SID,
    attemptNumber: 0,
    attemptPayload: {
      bucket: 'docs-bucket',
      key: 'transcripts/test-transcript.txt',
    },
    attemptResult: ContactJobAttemptResult.SUCCESS,
    contactId: parseInt(contact.id),
    jobId,
    jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    taskId: contact.taskId,
    twilioWorkerId: contact.twilioWorkerId,
    conversationMediaId,
    filePath: 'transcripts/test-transcript.txt',
    serviceSid: contact.serviceSid,
    channelSid: contact.channelSid,
  };
  return JSON.stringify(completedRetrieveTranscriptMessage);
};
