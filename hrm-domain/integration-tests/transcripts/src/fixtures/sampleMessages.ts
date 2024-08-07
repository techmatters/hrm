import { Contact } from '@tech-matters/hrm-types/dist/Contact';
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
    contactId: contact.id,
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
