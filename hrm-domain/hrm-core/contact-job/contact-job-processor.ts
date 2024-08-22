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
import { isAfter, parseISO, subMilliseconds } from 'date-fns';
import {
  ContactJob,
  markJobsAsAttempted,
  pullDueContactJobs,
} from './contact-job-data-access';
import { pollAndProcessCompletedContactJobs } from './contact-job-complete';
import { ContactJobPollerError } from './contact-job-error';
import { publishDueContactJobs } from './contact-job-publish';
import { ContactJobType } from '@tech-matters/types/dist';
import { db } from '../connection-pool';

let processingJobs = false;

const JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000; // 5 seconds
const MINIMUM_JOB_RETRY_INTERVAL_MILLISECONDS = 120000; // 2 minutes
const JOB_TYPE_SPECIFIC_RETRY_INTERVAL_MILLISECONDS: {
  [jobType in ContactJobType]?: number | undefined;
} = {
  [ContactJobType.SCRUB_CONTACT_TRANSCRIPT]: 30 * 60 * 1000, // 30 minutes
};
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
        const now = new Date();
        let dueContactJobs: ContactJob[] = [];
        await db.tx(async t => {
          const candidateDueContactJobs = await pullDueContactJobs(
            t,
            subMilliseconds(now, MINIMUM_JOB_RETRY_INTERVAL_MILLISECONDS),
            JOB_MAX_ATTEMPTS,
          );
          dueContactJobs = candidateDueContactJobs.filter(job => {
            const millis = JOB_TYPE_SPECIFIC_RETRY_INTERVAL_MILLISECONDS[job.jobType];
            return (
              !millis || isAfter(subMilliseconds(now, millis), parseISO(job.lastAttempt))
            );
          });
          await markJobsAsAttempted(
            t,
            dueContactJobs.map(job => job.id),
          );
        });
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
