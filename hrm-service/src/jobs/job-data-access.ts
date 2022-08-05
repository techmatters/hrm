import { db, pgp } from '../connection-pool';
import { COMPLETE_JOB_SQL, PULL_DUE_JOBS_SQL } from './sql/job-sql';
import { Contact } from '../contact/contact-data-access';

export const enum JobType {
  RETRIEVE_CONTACT_RECORDING_URL = 'retrieve-contact-recording-url',
  RETRIEVE_CONTACT_TRANSCRIPT = 'retrieve-contact-transcript',
}

type Job<TResource, TComplete = any, TAdditional = any> = {
  id: number;
  resource: TResource;
  completed?: Date;
  completionPayload?: TComplete;
  additionalPayload: TAdditional;
};

export type RetrieveContactRecordingJob = Job<Contact, string[], undefined> & {
  jobType: JobType.RETRIEVE_CONTACT_RECORDING_URL;
};

export type RetrieveContactTranscriptJob = Job<Contact, string[], undefined> & {
  jobType: JobType.RETRIEVE_CONTACT_TRANSCRIPT;
};

export type ContactJob = RetrieveContactRecordingJob | RetrieveContactTranscriptJob;

/**
 * Returns all the jobs that are considered 'due'
 * These are jobs that are not considered complete, and have also not been attempted since the time provided (to prevent jobs being retried too often)
 * The logic could be further enhanced with logic to consider a job 'abandoned', i.e. after a certain number of attempts or if requested too long ago.
 * This will pull the contact in its current state and add it to the job payload for sending
 * @param lastAttemptedBefore
 */
export const pullDueJobs = async (lastAttemptedBefore: Date): Promise<ContactJob[]> => {
  return db.task(conn => {
    return conn.manyOrNone<ContactJob>(PULL_DUE_JOBS_SQL, {
      lastAttemptedBefore: lastAttemptedBefore.toISOString(),
    });
  });
};

/**
 * Mark a job complete and record the completionPayload for posterity
 * @param id
 * @param completionPayload
 */
export const completeJob = async (id: number, completionPayload: any): Promise<ContactJob> => {
  return db.task(tx => {
    return tx.oneOrNone(COMPLETE_JOB_SQL, { id, completionPayload });
  });
};

/**
 * Add a new job to be completed to the ContactJobs queue
 * @param job
 */
export const createContactJob = async (job: Omit<ContactJob, 'id'>): Promise<void> => {
  const contact = job.resource;
  await db.task(tx => {
    const insertSql = pgp.helpers.insert(
      {
        requested: new Date().toISOString(),
        jobType: job.jobType,
        contactId: contact.id,
        accountSid: contact.accountSid,
        additionalPayload: job.additionalPayload,
      },
      null,
      'ContactJobs',
    );
    return tx.none(insertSql);
  });
};
