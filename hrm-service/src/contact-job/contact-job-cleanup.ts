import { ContactJobType } from '@tech-matters/types';
import {getClient} from '@tech-matters/twilio-client';
import { getSsmParameter } from '../config/ssmCache';
import { getPendingCleanupJobs, getPendingCleanupJobAccountSids } from './contact-job-data-access';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 365;

export const cleanupContactJobs = async (): Promise<void> => {
  const accountSids = await getPendingCleanupJobAccountSids(MAX_CLEANUP_JOB_RETENTION_DAYS);

  for (const accountSid of accountSids) {
    const cleanupRetentionDays =
      (await getSsmParameter(
        `/${process.env.NODE_ENV}/hrm/jobs/${accountSid}/contact/cleanup-retention-days`,
      )) || MAX_CLEANUP_JOB_RETENTION_DAYS;
    const pendingJobs = await getPendingCleanupJobs(accountSid, cleanupRetentionDays as number);

    for (const job of pendingJobs) {

    }
  }
};

export const cleanupContactJob = async (job: ContactJobRecord): Promise<void> => {
  if (job.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
    await cleanupRetrieveContactTranscriptJob(job);
  }
};

const cleanupRetrieveContactTranscriptJob = async (job: ContactJobRecord): Promise<void> => {