"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_MAX_ATTEMPTS = void 0;
exports.processContactJobs = processContactJobs;
const timers_1 = require("timers");
const date_fns_1 = require("date-fns");
const contact_job_data_access_1 = require("./contact-job-data-access");
const contact_job_complete_1 = require("./contact-job-complete");
const contact_job_error_1 = require("./contact-job-error");
const contact_job_publish_1 = require("./contact-job-publish");
const types_1 = require("@tech-matters/types");
const dbConnection_1 = require("../dbConnection");
const JOB_PROCESSING_SKIP = process.env.JOB_PROCESSING_SKIP || false;
let processingJobs = false;
let JOB_PROCESSING_INTERVAL_MILLISECONDS;
try {
    JOB_PROCESSING_INTERVAL_MILLISECONDS = process.env.JOB_PROCESSING_INTERVAL_MILLISECONDS
        ? parseInt(process.env.JOB_PROCESSING_INTERVAL_MILLISECONDS)
        : 5000;
}
catch (err) {
    console.error('Failed to parse JOB_PROCESSING_INTERVAL_MILLISECONDS from environment variable. Using default value.', err);
    JOB_PROCESSING_INTERVAL_MILLISECONDS = 5000;
}
const MINIMUM_JOB_RETRY_INTERVAL_MILLISECONDS = 120000; // 2 minutes
const JOB_TYPE_SPECIFIC_RETRY_INTERVAL_MILLISECONDS = {
    [types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT]: 30 * 60 * 1000, // 30 minutes
};
exports.JOB_MAX_ATTEMPTS = 20;
function processContactJobs() {
    if (!processingJobs && !JOB_PROCESSING_SKIP) {
        console.info(`Started processing jobs every ${JOB_PROCESSING_INTERVAL_MILLISECONDS} milliseconds.`);
        processingJobs = true;
        return (0, timers_1.setInterval)(async () => {
            try {
                // console.debug(`processContactJobs sweep started.`);
                await (0, contact_job_complete_1.pollAndProcessCompletedContactJobs)(exports.JOB_MAX_ATTEMPTS);
                const now = new Date();
                let dueContactJobs = [];
                await dbConnection_1.db.tx(async (t) => {
                    const candidateDueContactJobs = await (0, contact_job_data_access_1.pullDueContactJobs)(t, (0, date_fns_1.subMilliseconds)(now, MINIMUM_JOB_RETRY_INTERVAL_MILLISECONDS), exports.JOB_MAX_ATTEMPTS);
                    dueContactJobs = candidateDueContactJobs.filter(job => {
                        const millis = JOB_TYPE_SPECIFIC_RETRY_INTERVAL_MILLISECONDS[job.jobType];
                        if (!millis || !job.lastAttempt)
                            return true;
                        return (0, date_fns_1.isAfter)((0, date_fns_1.subMilliseconds)(now, millis), (0, date_fns_1.parseISO)(job.lastAttempt));
                    });
                    if (dueContactJobs.length) {
                        await (0, contact_job_data_access_1.markJobsAsAttempted)(t, dueContactJobs.map(job => job.id));
                    }
                });
                await (0, contact_job_publish_1.publishDueContactJobs)(dueContactJobs);
                // console.debug(`processContactJobs sweep complete.`);
            }
            catch (err) {
                console.error(new contact_job_error_1.ContactJobPollerError('JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR'), err);
            }
        }, JOB_PROCESSING_INTERVAL_MILLISECONDS);
    }
    else {
        console.warn(`processContactJobs repeating task already running`);
    }
}
