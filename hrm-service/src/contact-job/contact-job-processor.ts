import { setInterval } from 'timers';
import { subMilliseconds } from 'date-fns';
import { pullDueContactJobs } from './contact-job-data-access';
import { pollAndprocessCompletedContactJobs } from './contact-job-complete';
import { publishDueContactJobs } from './contact-job-publish';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000; // 5 seconds
const JOB_RETRY_INTERVAL_MILLISECONDS = 120000; // 2 minutes

export const getProcessingInterval = () => JOB_PROCESSING_INTERVAL_MILLISECONDS;
export const getRetryInterval = () => JOB_RETRY_INTERVAL_MILLISECONDS;

export function processContactJobs() {
  if (!processingJobs) {
    console.log(`Started processing jobs every ${getProcessingInterval()} milliseconds.`);
    processingJobs = true;

    return setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const completedJobs = await pollAndprocessCompletedContactJobs();

        const dueContactJobs = await pullDueContactJobs(
          subMilliseconds(new Date(), getRetryInterval()),
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const publishedContactJobResult = await publishDueContactJobs(dueContactJobs);
      } catch (err) {
        console.error('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR', err);
      }
    }, getProcessingInterval());
  } else {
    console.warn(`processContactJobs repeating task already running`);
  }
}
