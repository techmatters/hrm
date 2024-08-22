/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { setInterval } from 'timers';
import { subMilliseconds } from 'date-fns';
import { pullDueContactJobs } from './contact-job-data-access';
import { pollAndProcessCompletedContactJobs } from './contact-job-complete';
import { ContactJobPollerError } from './contact-job-error';
import { publishDueContactJobs } from './contact-job-publish';

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
        await pollAndProcessCompletedContactJobs(JOB_MAX_ATTEMPTS);

        const dueContactJobs = await pullDueContactJobs(
          subMilliseconds(new Date(), JOB_RETRY_INTERVAL_MILLISECONDS),
          JOB_MAX_ATTEMPTS,
        );

        await publishDueContactJobs(dueContactJobs);
      } catch (err) {
        console.error(
          new ContactJobPollerError(
            'JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR',
          ),
          err,
        );
      }
    }, JOB_PROCESSING_INTERVAL_MILLISECONDS);
  } else {
    console.warn(`processContactJobs repeating task already running`);
  }
}
