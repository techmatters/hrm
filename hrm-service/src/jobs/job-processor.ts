import { setInterval } from 'timers';
import { processCompleteJobs } from './job-complete';
import { publishPendingJobs } from './job-publish';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000;
const JOB_RETRY_INTERVAL_MILLISECONDS = 60000;

export async function processJobs() {
  if (!processingJobs) {
    console.log(
      `Started processing jobs every ${JOB_PROCESSING_INTERVAL_MILLISECONDS} milliseconds.`,
    );
    processingJobs = true;

    setInterval(async () => {
      console.log('Another round!');
      // This is the primary job processing 'loop'
      // First we process any completed jobs. These completed jobs would be pulled from a queue in prod but we just have a cheap in memory simulation using an array here
      try {
        const completedJobs = await processCompleteJobs();

        // Process completed jobs
        console.log(completedJobs);

        const pusblishResults = await publishPendingJobs(JOB_RETRY_INTERVAL_MILLISECONDS);

        // Process published results
        console.log(pusblishResults);
      } catch (err) {
        // TODO: Should we add some monitoring on this?
        console.error('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR', err);
      }
    }, JOB_PROCESSING_INTERVAL_MILLISECONDS);
  } else {
    console.warn(`scanForJobsDueToRun repeating task already running`);
  }
}
