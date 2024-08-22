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

import { db, pgp } from '../connection-pool';
import type { Contact } from '../contact/contactDataAccess';
import {
  ADD_FAILED_ATTEMPT_PAYLOAD,
  ContactJobCleanupStatus,
  COMPLETE_JOB_SQL,
  DELETE_JOB_SQL,
  PENDING_CLEANUP_JOBS_SQL,
  PENDING_CLEANUP_JOB_ACCOUNT_SIDS_SQL,
  PULL_DUE_JOBS_SQL,
  selectSingleContactJobByIdSql,
  UPDATE_JOB_CLEANUP_ACTIVE_SQL,
  UPDATE_JOB_CLEANUP_PENDING_SQL,
} from './sql/contact-job-sql';
import { txIfNotInOne } from '../sql';

import { ContactJobType, HrmAccountId } from '@tech-matters/types';
import { ConversationMedia } from '../conversation-media/conversation-media';

// Reflects the actual shape of a record in the ContactJobs table
export type ContactJobRecord = {
  id: number;
  contactId: number;
  accountSid: HrmAccountId;
  jobType: string;
  requested: string;
  completed: string | null;
  lastAttempt: string | null;
  numberOfAttempts: number;
  additionalPayload: any;
  completionPayload: any;
};

// ContactJob base interface, picks the properties used from ContactJobRecord plus the resource Contact
type Job<TComplete, TAdditional> = Omit<
  ContactJobRecord,
  'completionPayload' | 'additionalPayload'
> & {
  completionPayload: TComplete;
  additionalPayload: TAdditional;
  resource: Contact;
};

export type RetrieveContactTranscriptJob = Job<
  string[] | null,
  { conversationMediaId: ConversationMedia['id'] }
> & {
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT;
};

export type ScrubContactTranscriptJob = Job<
  string[] | null,
  {
    originalLocation: { bucket: string; key: string };
  }
> & {
  jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT;
};

export type ContactJob = RetrieveContactTranscriptJob | ScrubContactTranscriptJob;

export const getContactJobById = async (jobId: number): Promise<ContactJobRecord> =>
  db.task(async connection =>
    connection.oneOrNone<ContactJobRecord>(selectSingleContactJobByIdSql('ContactJobs'), {
      jobId,
    }),
  );

/**
 * Returns all the jobs that are considered 'due'
 * These are jobs that are not considered complete, and have also not been attempted since the time provided (to prevent jobs being retried too often)
 * The logic will also consider a job 'abandoned', after a certain number of attempts.
 * This will pull the contact in its current state and add it to the job payload for sending
 * @param lastAttemptedBefore
 */
export const pullDueContactJobs = async (
  lastAttemptedBefore: Date,
  jobMaxAttempts: number,
): Promise<ContactJob[]> => {
  return db.task(tx => {
    return tx.manyOrNone<ContactJob>(PULL_DUE_JOBS_SQL, {
      lastAttemptedBefore: lastAttemptedBefore.toISOString(),
      jobMaxAttempts,
    });
  });
};

/**
 * Mark a job complete and record the completionPayload for posterity
 * @param id
 * @param completionPayload
 * @param wasSuccessful
 */
export const completeContactJob = async ({
  id,
  completionPayload,
  wasSuccessful = true,
}: {
  id: number;
  completionPayload: any;
  wasSuccessful?: boolean;
}): Promise<ContactJobRecord> => {
  const cleanupStatus = wasSuccessful
    ? ContactJobCleanupStatus.PENDING
    : ContactJobCleanupStatus.NOT_READY;
  return db.task(tx => {
    return tx.oneOrNone(COMPLETE_JOB_SQL, { id, completionPayload, cleanupStatus });
  });
};

/**
 * Add a new job to be completed to the ContactJobs queue
 * Requires tx: ITask to make the creation of the job part of the same transaction
 */
export const createContactJob =
  (tk?) =>
  async (
    job: Pick<ContactJob, 'jobType' | 'resource' | 'additionalPayload'>,
  ): Promise<void> => {
    const contact = job.resource;
    const insertSql = pgp.helpers.insert(
      {
        requested: new Date().toISOString(),
        jobType: job.jobType,
        contactId: contact.id,
        accountSid: contact.accountSid,
        additionalPayload: job.additionalPayload,
        lastAttempt: null,
        numberOfAttempts: 0,
        completed: null,
        completionPayload: null,
      },
      null,
      'ContactJobs',
    );

    return txIfNotInOne(tk, conn => conn.none(insertSql));
  };

export const appendFailedAttemptPayload = async (
  contactJobId: ContactJob['id'],
  attemptNumber: number,
  attemptPayload: any,
): Promise<ContactJob> =>
  db.task(tx =>
    tx.oneOrNone<ContactJob>(ADD_FAILED_ATTEMPT_PAYLOAD, {
      contactJobId,
      attemptNumber,
      attemptPayload,
    }),
  );

export const getPendingCleanupJobs = async (
  accountSid: string,
  cleanupRetentionDays: number,
): Promise<RetrieveContactTranscriptJob[]> => {
  return db.task(tx =>
    tx.manyOrNone<RetrieveContactTranscriptJob>(PENDING_CLEANUP_JOBS_SQL, {
      accountSid,
      cleanupRetentionDays,
    }),
  );
};

export const getPendingCleanupJobAccountSids = async (): Promise<string[]> => {
  const ret = await db.task(tx => tx.manyOrNone(PENDING_CLEANUP_JOB_ACCOUNT_SIDS_SQL));
  return ret?.map(r => r.accountSid);
};

export const deleteContactJob = async (
  accountSid: HrmAccountId,
  jobId: number,
): Promise<void> => {
  return db.task(tx => tx.none(DELETE_JOB_SQL, { accountSid, jobId }));
};

export const setContactJobCleanupActive = async (jobId: number): Promise<void> => {
  return db.task(tx => tx.none(UPDATE_JOB_CLEANUP_ACTIVE_SQL, { jobId }));
};

export const setContactJobCleanupPending = async (jobId: number): Promise<void> => {
  return db.task(tx => tx.none(UPDATE_JOB_CLEANUP_PENDING_SQL, { jobId }));
};
