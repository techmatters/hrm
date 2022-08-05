import { completeJob, JobType } from './job-data-access';
import { deletedCompletedJobs, pollCompletedJobs } from './client-sqs';
import { assertExhaustive } from './assertExhaustive';
import { PublishRetrieveContactTranscript, PublishRetrieveContactRecordingUrl } from './client-sns';
import { appendMediaUrls } from '../contact/contact-data-access';
import { ContactMediaType } from '../contact/contact-json';

// Expected payload for a completed JobType.RETRIEVE_CONTACT_TRANSCRIPT
export type RetrieveContactTranscriptCompleted = PublishRetrieveContactTranscript & {
  completionPayload: string;
};

// Expected payload for a completed JobType.RETRIEVE_CONTACT_RECORDING_URL
export type RetrieveContactRecordingUrlCompleted = PublishRetrieveContactRecordingUrl & {
  completionPayload: any;
};

type CompletedJobBody = RetrieveContactTranscriptCompleted | RetrieveContactRecordingUrlCompleted;

/**
 * Adds the transcript URL to the contact
 */
async function processRetrieveContactTranscriptCompleted(job: RetrieveContactTranscriptCompleted) {
  await appendMediaUrls(job.accountSid, job.contactId, [
    {
      url: job.completionPayload,
      type: ContactMediaType.TRANSCRIPT,
    },
  ]);
}

const processCompletedJob = async (completedJob: CompletedJobBody) => {
  // Do stuff with the completed job results
  switch (completedJob.jobType) {
    case JobType.RETRIEVE_CONTACT_TRANSCRIPT: {
      return processRetrieveContactTranscriptCompleted(completedJob);
    }
    case JobType.RETRIEVE_CONTACT_RECORDING_URL: {
      // await processRetrieveContactRecordingUrlCompletion(completedJob);
      return;
    }
    default:
      assertExhaustive(completedJob);
  }
};

export const processCompleteJobs = async () => {
  const polledCompletedJobs = await pollCompletedJobs();

  const { Messages: messages } = polledCompletedJobs;
  console.log(messages);

  if (Array.isArray(messages) && messages.length) {
    console.log(`Processing ${messages.length} completed jobs`);

    const completedJobs = await Promise.allSettled(
      messages.map(async m => {
        const completedJob: CompletedJobBody = JSON.parse(m.Body);

        await processCompletedJob(completedJob);

        // Mark the job as completed
        const markedComplete = await completeJob(
          completedJob.jobId,
          completedJob.completionPayload,
        );
        // Delete the message from the queue (this could be batched)
        await deletedCompletedJobs(m.ReceiptHandle);

        return markedComplete;
      }),
    );

    return completedJobs;
  }
};
