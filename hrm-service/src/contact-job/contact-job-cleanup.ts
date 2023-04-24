import { ContactJobType } from '@tech-matters/types';
import { getClient } from '@tech-matters/hrm-twilio-client';
import { getSsmParameter } from '../config/ssmCache';
import {
  deleteContactJob,
  ContactJobRecord,
  getPendingCleanupJobs,
  getPendingCleanupJobAccountSids,
} from './contact-job-data-access';

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

export const cleanupRetrieveContactTranscriptJob = async (job: ContactJobRecord): Promise<void> => {
  const { acccountSid } = job;
  const client = await getClient({ accountSid });
  try {
    await client.chat.v2
      .services('your-service-sid')
      .channels('your-channel-sid')
      .remove();
  } catch (err) {
    if (err instanceof RestException && err.status === 404) {
      console.log(`Channel ${job.channelSid} not found, skipping cleanup`);
      return;
    }

    console.error(
      `Error cleaning up twilio channel ${job.channelSid} for job ${job.jobId}: ${err}`,
    );
    return;
  }

  await deleteContactJob(job.accountSid, job.jobId);
};

export const cleanupContactJob = async (job: ContactJobRecord): Promise<void> => {
  if (job.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
    await cleanupRetrieveContactTranscriptJob(job);
  }
};
