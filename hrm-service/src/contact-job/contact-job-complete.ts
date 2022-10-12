import { completeContactJob, ContactJobType } from './contact-job-data-access';
import { deletedCompletedContactJobs, pollCompletedContactJobs } from './client-sqs';
import { CompletedContactJobBody, TestContactJobCompleted } from './contact-job-messages';

async function processTestContactJobCompleted(completedJob: TestContactJobCompleted) {
  return completedJob;
}

const processCompletedContactJob = async (completedJob: CompletedContactJobBody) => {
  switch (completedJob.jobType) {
    case ContactJobType.TEST_CONTACT_JOB: {
      return processTestContactJobCompleted(completedJob);
    }
  }
};

export const processCompleteContactJobs = async () => {
  const polledCompletedJobs = await pollCompletedContactJobs();

  const { Messages: messages } = polledCompletedJobs;

  if (Array.isArray(messages) && messages.length) {
    const completedJobs = await Promise.allSettled(
      messages.map(async m => {
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
      }),
    );

    return completedJobs;
  }
};
