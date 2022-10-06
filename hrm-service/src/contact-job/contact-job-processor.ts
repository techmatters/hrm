import { setInterval } from 'timers';
import { subMilliseconds } from 'date-fns';
import { pullDueContactJobs } from './contact-job-data-access';
import { pollAndprocessCompletedContactJobs } from './contact-job-complete';
import { publishDueContactJobs } from './contact-job-publish';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000; // 5 seconds
const JOB_RETRY_INTERVAL_MILLISECONDS = 120000; // 2 minutes
const JOB_MAX_ATTEMPTS = 20;

export function processContactJobs() {
  if (!processingJobs) {
    console.log(
      `Started processing jobs every ${JOB_PROCESSING_INTERVAL_MILLISECONDS} milliseconds.`,
    );
    processingJobs = true;

    return setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const completedJobs = await pollAndprocessCompletedContactJobs(JOB_MAX_ATTEMPTS);

        const dueContactJobs = await pullDueContactJobs(
          subMilliseconds(new Date(), JOB_RETRY_INTERVAL_MILLISECONDS),
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const publishedContactJobResult = await publishDueContactJobs(dueContactJobs);
      } catch (err) {
        console.error('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR', err);
      }
    }, JOB_PROCESSING_INTERVAL_MILLISECONDS);
  } else {
    console.warn(`processContactJobs repeating task already running`);
  }
}
