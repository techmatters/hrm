import { format, subMilliseconds } from 'date-fns';
import { pullDueJobs, RetrieveContactTranscriptJob } from './job-data-access';
import { publishToJobsTopic } from './client-sns';
import { JobType } from './job-data-access';
import { PublishCommandOutput } from '@aws-sdk/client-sns';
import { assertExhaustive } from './assertExhaustive';

export const publishRetrieveContactTranscriptJob = (job: RetrieveContactTranscriptJob) => {
  const {
    accountSid,
    id: contactId,
    serviceSid,
    channelSid,
    taskId,
    twilioWorkerId,
    createdAt,
  } = job.resource;

  const dateBasedPath = format(new Date(createdAt), 'yyyy/MM/dd/yyyyMMddHHmmss');
  const filePath = `transcripts/${dateBasedPath}-${taskId}.json`;

  return publishToJobsTopic({
    jobType: job.jobType,
    jobId: job.id,
    accountSid,
    contactId,
    serviceSid,
    channelSid,
    taskId,
    twilioWorkerId,
    filePath,
  });
};

export const publishPendingJobs = async (
  jobRetryIntervalMiliseconds: number,
): Promise<PromiseSettledResult<PublishCommandOutput>[]> => {
  console.log(`Checking for due jobs`);

  // This pulls any jobs due to be run and marks them as attempted
  const jobs = await pullDueJobs(subMilliseconds(new Date(), jobRetryIntervalMiliseconds));

  console.log(`Found ${jobs.length} jobs due to action`);

  // for (const job of jobs) { looping in a for process each job sync, is that required? Or we can go with firing all of them async?
  const publishResults = await Promise.allSettled(
    jobs.map(job => {
      switch (job.jobType) {
        case JobType.RETRIEVE_CONTACT_TRANSCRIPT: {
          return publishRetrieveContactTranscriptJob(job);
        }
        case JobType.RETRIEVE_CONTACT_RECORDING_URL: {
          // job.completionPayload = await processRetrieveContactRecordingUrlJob(job);
          return;
        }
        // If there's an unhandled case, below statement will error at compile time
        default:
          assertExhaustive(job);
      }
    }),
  );

  return publishResults;
};
