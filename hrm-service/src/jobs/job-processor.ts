import { setInterval } from 'timers';
import { completeJob, ContactJob, pullDueJobs, JobType } from './job-data-access';
import {
  processRetrieveContactRecordingUrlCompletion,
  processRetrieveContactRecordingUrlJob,
} from './contact-recording-url-job';

let processingJobs = false;
const completedJobs: ContactJob[] = [];
const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000;

export async function processJobs() {
  if (!processingJobs) {
    console.log(
      `Started processing jobs every ${JOB_PROCESSING_INTERVAL_MILLISECONDS} milliseconds.`,
    );
    processingJobs = true;
    setInterval(async () => {
      // This is the primary job processing 'loop'
      // First we process any completed jobs. These completed jobs would be pulled from a queue in prod but we just have a cheap in memory simulation using an array here
      try {
        console.log(`Processing ${completedJobs.length} completed jobs`);
        let completedJob;
        while ((completedJob = completedJobs.shift())) {
          switch (completedJob.jobType) {
            case JobType.RETRIEVE_CONTACT_RECORDING_URL:
              await processRetrieveContactRecordingUrlCompletion(completedJob);
          }
          await completeJob(completedJob.id, completedJob.completionPayload);
        }

        console.log(`Checking for due jobs`);
        // This pulls any jobs due to be run and marks them as attempted
        const jobs = await pullDueJobs(new Date());
        console.log(`Found ${jobs.length} jobs due to action`);
        for (const job of jobs) {
          console.log(job);
          // Run job - this could be processed locally or pushed to a queue to run on a lambda
          switch (job.jobType) {
            case JobType.RETRIEVE_CONTACT_RECORDING_URL:
              job.completionPayload = await processRetrieveContactRecordingUrlJob(job);
          }

          // If a job errors in a manner that should not be retried, return an error payload.
          // A falsy completion payload indicates the job was not complete but can be retried
          if (job.completionPayload) {
            console.log(`Job completed`, {
              id: job.id,
              contactId: job.resource.id,
              accountSid: job.resource.accountSid,
              completionPayload: job.completionPayload,
            });
            completedJobs.push(job);
          } else {
            console.log(`Job could not be completed, will retry`, {
              id: job.id,
              contactId: job.resource.id,
              accountSid: job.resource.accountSid,
            });
          }
        }
      } catch (err) {
        console.error('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR', err);
      }
    }, JOB_PROCESSING_INTERVAL_MILLISECONDS);
  } else {
    console.warn(`scanForJobsDueToRun repeating task already running`);
  }
}
