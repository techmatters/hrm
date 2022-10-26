import {
  ContactJobType,
  completeContactJob,
  appendFailedAttemptPayload,
} from './contact-job-data-access';
import {
  deleteCompletedContactJobsFromQueue,
  pollCompletedContactJobsFromQueue,
} from './client-sqs';
import {
  CompletedContactJobBody,
  CompletedRetrieveContactTranscript,
} from './contact-job-messages';
import {
  getContactById,
  updateConversationMedia,
  S3StoredTranscript,
  isS3StoredTranscriptPending,
} from '../contact/contact';
import { assertExhaustive } from './assertExhaustive';

export const processCompletedRetrieveContactTranscript = async (
  completedJob: CompletedRetrieveContactTranscript,
) => {
  const contact = await getContactById(completedJob.accountSid, completedJob.contactId);
  const { conversationMedia } = contact.rawJson;

  const transcriptEntryIndex = conversationMedia?.findIndex(isS3StoredTranscriptPending);

  if (transcriptEntryIndex < 0) {
    throw new Error(
      `Contact with id ${contact.id} does not have a pending transcript entry in conversationMedia`,
    );
  }

  (<S3StoredTranscript>conversationMedia[transcriptEntryIndex]).url = completedJob.attemptPayload;

  return updateConversationMedia(
    completedJob.accountSid,
    completedJob.contactId,
    conversationMedia,
  );
};

const processCompletedContactJob = async (completedJob: CompletedContactJobBody) => {
  switch (completedJob.jobType) {
    case ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
      return processCompletedRetrieveContactTranscript(completedJob);
    }
    // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
    default:
      assertExhaustive(completedJob as never);
  }
};

export const pollAndprocessCompletedContactJobs = async (jobMaxAttempts: number) => {
  const polledCompletedJobs = await pollCompletedContactJobsFromQueue();

  const { Messages: messages } = polledCompletedJobs;

  if (!Array.isArray(messages)) {
    throw new Error(`polledCompletedJobs returned invalid messages format ${messages}`);
  }

  const completedJobs = await Promise.allSettled(
    messages.map(async m => {
      try {
        const completedJob: CompletedContactJobBody = JSON.parse(m.Body);

        if (completedJob.attemptResult === 'success') {
          await processCompletedContactJob(completedJob);

          // Mark the job as completed
          const completionPayload = {
            message: 'Job processed successfully',
            value: completedJob.attemptPayload,
          };
          const markedComplete = await completeContactJob(completedJob.jobId, completionPayload);

          // Delete the message from the queue (this could be batched)
          await deleteCompletedContactJobsFromQueue(m.ReceiptHandle);

          return markedComplete;
        } else {
          const { jobId, attemptNumber, attemptPayload } = completedJob;
          const updated = await appendFailedAttemptPayload(jobId, attemptNumber, attemptPayload);

          if (attemptNumber >= jobMaxAttempts) {
            const completionPayload = { message: 'Attempts limit reached' };
            const markedComplete = await completeContactJob(completedJob.jobId, completionPayload);

            await deleteCompletedContactJobsFromQueue(m.ReceiptHandle);

            return markedComplete;
          }

          return updated;
        }
      } catch (err) {
        console.error('Failed to process CompletedContactJobBody:', m, err);
        return Promise.reject(err);
      }
    }),
  );

  return completedJobs;
};
