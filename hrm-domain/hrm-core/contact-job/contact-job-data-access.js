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
exports.setContactJobCleanupPending = exports.setContactJobCleanupActive = exports.deleteContactJob = exports.getPendingCleanupJobAccountSids = exports.getPendingCleanupJobs = exports.appendFailedAttemptPayload = exports.createContactJob = exports.completeContactJob = exports.markJobsAsAttempted = exports.pullDueContactJobs = exports.getContactJobById = void 0;
const dbConnection_1 = require("../dbConnection");
const contact_job_sql_1 = require("./sql/contact-job-sql");
const sql_1 = require("../sql");
const getContactJobById = async (jobId) => (0, dbConnection_1.getDbForAdmin)().task(async (connection) => connection.oneOrNone((0, contact_job_sql_1.selectSingleContactJobByIdSql)('ContactJobs'), {
    jobId,
}));
exports.getContactJobById = getContactJobById;
/**
 * Returns all the jobs that are considered 'due'
 * These are jobs that are not considered complete, and have also not been attempted since the time provided (to prevent jobs being retried too often)
 * The logic will also consider a job 'abandoned', after a certain number of attempts.
 * This will pull the contact in its current state and add it to the job payload for sending
 */
const pullDueContactJobs = async (tx, lastAttemptedBefore, jobMaxAttempts) => {
    return tx.manyOrNone(contact_job_sql_1.PULL_DUE_JOBS_SQL, {
        lastAttemptedBefore: lastAttemptedBefore.toISOString(),
        jobMaxAttempts,
    });
};
exports.pullDueContactJobs = pullDueContactJobs;
const markJobsAsAttempted = async (tx, jobIds) => {
    return tx.none(contact_job_sql_1.INCREMENT_JOBS_ATTEMPTS_SQL, { jobIds });
};
exports.markJobsAsAttempted = markJobsAsAttempted;
/**
 * Mark a job complete and record the completionPayload for posterity
 * @param id
 * @param completionPayload
 * @param wasSuccessful
 */
const completeContactJob = async ({ id, completionPayload, wasSuccessful = true, }) => {
    const cleanupStatus = wasSuccessful
        ? contact_job_sql_1.ContactJobCleanupStatus.PENDING
        : contact_job_sql_1.ContactJobCleanupStatus.NOT_READY;
    return (0, dbConnection_1.getDbForAdmin)().task(tx => {
        return tx.oneOrNone(contact_job_sql_1.COMPLETE_JOB_SQL, { id, completionPayload, cleanupStatus });
    });
};
exports.completeContactJob = completeContactJob;
/**
 * Add a new job to be completed to the ContactJobs queue
 * Requires tx: ITask to make the creation of the job part of the same transaction
 */
const createContactJob = (tk) => async (job) => {
    const contact = job.resource;
    const insertSql = `${dbConnection_1.pgp.helpers.insert({
        requested: new Date().toISOString(),
        jobType: job.jobType,
        contactId: contact.id,
        accountSid: contact.accountSid,
        additionalPayload: job.additionalPayload,
        lastAttempt: null,
        numberOfAttempts: 0,
        completed: null,
        completionPayload: null,
    }, null, 'ContactJobs')} RETURNING *`;
    const { id, jobType, contactId, accountSid } = await (0, sql_1.txIfNotInOne)((0, dbConnection_1.getDbForAdmin)(), tk, conn => conn.one(insertSql));
    console.info(`[contact-job](${accountSid}) Creating new job ${jobType} / ${id}, contact ${contactId}`);
};
exports.createContactJob = createContactJob;
const appendFailedAttemptPayload = async (contactJobId, attemptNumber, attemptPayload) => (0, dbConnection_1.getDbForAdmin)().task(tx => tx.oneOrNone(contact_job_sql_1.ADD_FAILED_ATTEMPT_PAYLOAD, {
    contactJobId,
    attemptNumber,
    attemptPayload,
}));
exports.appendFailedAttemptPayload = appendFailedAttemptPayload;
const getPendingCleanupJobs = async (accountSid, cleanupRetentionDays) => {
    return (0, dbConnection_1.getDbForAdmin)().task(tx => tx.manyOrNone(contact_job_sql_1.PENDING_CLEANUP_JOBS_SQL, {
        accountSid,
        cleanupRetentionDays,
    }));
};
exports.getPendingCleanupJobs = getPendingCleanupJobs;
const getPendingCleanupJobAccountSids = async () => {
    const ret = await (0, dbConnection_1.getDbForAdmin)().task(tx => tx.manyOrNone(contact_job_sql_1.PENDING_CLEANUP_JOB_ACCOUNT_SIDS_SQL));
    return ret?.map(r => r.accountSid);
};
exports.getPendingCleanupJobAccountSids = getPendingCleanupJobAccountSids;
const deleteContactJob = async (accountSid, jobId) => {
    return (0, dbConnection_1.getDbForAdmin)().task(tx => tx.none(contact_job_sql_1.DELETE_JOB_SQL, { accountSid, jobId }));
};
exports.deleteContactJob = deleteContactJob;
const setContactJobCleanupActive = async (jobId) => {
    return (0, dbConnection_1.getDbForAdmin)().task(tx => tx.none(contact_job_sql_1.UPDATE_JOB_CLEANUP_ACTIVE_SQL, { jobId }));
};
exports.setContactJobCleanupActive = setContactJobCleanupActive;
const setContactJobCleanupPending = async (jobId) => {
    return (0, dbConnection_1.getDbForAdmin)().task(tx => tx.none(contact_job_sql_1.UPDATE_JOB_CLEANUP_PENDING_SQL, { jobId }));
};
exports.setContactJobCleanupPending = setContactJobCleanupPending;
