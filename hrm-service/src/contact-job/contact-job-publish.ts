import { subMilliseconds } from 'date-fns';
import { pullDueContactJobs, TestContactJob } from './contact-job-data-access';
import { publishToContactJobsTopic } from './client-sns';
import { ContactJobType } from './contact-job-data-access';

export const publishTestContactJob = (contactJob: TestContactJob) => {
  const { accountSid, id: contactId, taskId, twilioWorkerId } = contactJob.resource;

  return publishToContactJobsTopic({
    jobType: contactJob.jobType,
    jobId: contactJob.id,
    accountSid,
    contactId,
    taskId,
    twilioWorkerId,
  });
};

type PublishedContactJobResult = Awaited<ReturnType<typeof publishTestContactJob>>;

export const publishPendingContactJobs = async (
  contactJobRetryIntervalMiliseconds: number,
): Promise<PromiseSettledResult<PublishedContactJobResult>[]> => {
  // This pulls any jobs due to be run and marks them as attempted
  const pendingJobs = await pullDueContactJobs(
    subMilliseconds(new Date(), contactJobRetryIntervalMiliseconds),
  );

  const publishResults = await Promise.allSettled(
    pendingJobs.map((pendingJob: TestContactJob) => {
      switch (pendingJob.jobType) {
        case ContactJobType.TEST_CONTACT_JOB:
          return publishTestContactJob(pendingJob);
      }
    }),
  );

  return publishResults;
};
