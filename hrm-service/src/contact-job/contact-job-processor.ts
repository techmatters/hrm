import { setInterval } from 'timers';
import { processCompleteContactJobs } from './contact-job-complete';
import { publishPendingContactJobs } from './contact-job-publish';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000;
const JOB_RETRY_INTERVAL_MILLISECONDS = 60000;

export const getProcessingInterval = () => JOB_PROCESSING_INTERVAL_MILLISECONDS;
export const getRetryInterval = () => JOB_RETRY_INTERVAL_MILLISECONDS;

export function processContactJobs() {
  if (!processingJobs) {
    console.log(`Started processing jobs every ${getProcessingInterval()} milliseconds.`);
    processingJobs = true;

    return setInterval(async () => {
      // This is the primary job processing 'loop'
      // First we process any completed jobs. These completed jobs would be pulled from a queue in prod but we just have a cheap in memory simulation using an array here
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const completedJobs = await processCompleteContactJobs();

        // Process completed jobs
        // console.log(completedJobs);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const pusblishResults = await publishPendingContactJobs(getRetryInterval());

        // Process published results
        // console.log(pusblishResults);
      } catch (err) {
        console.error('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR', err);
      }
    }, getProcessingInterval());
  } else {
    console.warn(`processContactJobs repeating task already running`);
  }
}
