import { setInterval } from 'timers';
import { subMilliseconds } from 'date-fns';
import { pullDueContactJobs } from './contact-job-data-access';
import { pollAndProcessCompletedContactJobs } from './contact-job-complete';
import { publishDueContactJobs } from './contact-job-publish';
import { loadSsmCache } from '../config/ssmCache';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000; // 5 seconds
const JOB_RETRY_INTERVAL_MILLISECONDS = 120000; // 2 minutes
export const JOB_MAX_ATTEMPTS = 20;

export function processContactJobs() {
  if (!processingJobs) {
    console.log(
      `Started processing jobs every ${JOB_PROCESSING_INTERVAL_MILLISECONDS} milliseconds.`,
    );
    processingJobs = true;

    return setInterval(async () => {
      try {
        //TODO: once this handles other config variables besides those needed
        // for SQS, it should be moved out of this loop.
        await loadSsmCache();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const completedJobs = await pollAndProcessCompletedContactJobs(JOB_MAX_ATTEMPTS);

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
