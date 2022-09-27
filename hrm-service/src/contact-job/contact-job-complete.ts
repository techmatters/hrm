import { completeContactJob, ContactJobType } from './contact-job-data-access';
import { deletedCompletedContactJobs, pollCompletedContactJobs } from './client-sqs';
import {
  CompletedContactJobBody,
  CompletedRetrieveContactTranscript,
} from './contact-job-messages';
import { appendMediaUrls } from '../contact/contact-data-access';
import { ContactMediaType } from '../contact/contact-json';
import { assertExhaustive } from './assertExhaustive';

const processCompletedRetrieveContactTranscript = async (
  completedJob: CompletedRetrieveContactTranscript,
) => {
  return appendMediaUrls(completedJob.accountSid, completedJob.contactId, [
    {
      url: completedJob.completionPayload,
      type: ContactMediaType.TRANSCRIPT,
    },
  ]);
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

export const pollAndprocessCompletedContactJobs = async () => {
  const polledCompletedJobs = await pollCompletedContactJobs();

  const { Messages: messages } = polledCompletedJobs;

  if (Array.isArray(messages) && messages.length) {
    const completedJobs = await Promise.allSettled(
      messages.map(async m => {
        try {
          const completedJob: CompletedContactJobBody = JSON.parse(m.Body);

          await processCompletedContactJob(completedJob);

          // Mark the job as completed
          const markedComplete = await completeContactJob(
            completedJob.jobId,
            completedJob.completionPayload,
          );

          // Delete the message from the queue (this could be batched)
          await deletedCompletedContactJobs(m.ReceiptHandle);

          return markedComplete;
        } catch (err) {
          console.error('Failed to process completed CompletedContactJobBody:', m, err);
        }
      }),
    );

    return completedJobs;
  }
};
