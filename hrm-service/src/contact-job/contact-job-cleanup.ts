import { ContactJobType } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import RestException from 'twilio/lib/base/RestException';
import { getSsmParameter } from '../config/ssmCache';
import {
  deleteContactJob,
  RetrieveContactTranscriptJob,
  getPendingCleanupJobs,
  getPendingCleanupJobAccountSids,
} from './contact-job-data-access';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 365;

export const cleanupRetrieveContactTranscriptJob = async (
  job: RetrieveContactTranscriptJob,
): Promise<void> => {
  const { accountSid, id } = job;
  const { channelSid } = job.resource;
  const client = await getClient({ accountSid });
  try {
    await client.chat.v2
      .services('your-service-sid')
      .channels('your-channel-sid')
      .remove();
  } catch (err) {
    if (err instanceof RestException && err.status === 404) {
      console.log(`Channel ${channelSid} not found, skipping cleanup`);
      return;
    }

    console.error(`Error cleaning up twilio channel ${channelSid} for job ${id}: ${err}`);
    return;
  }

  await deleteContactJob(accountSid, id);

  console.log(`Successfully cleaned up contact job ${id}`);
};

export const cleanupContactJob = async (job: RetrieveContactTranscriptJob): Promise<void> => {
  if (job.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
    await cleanupRetrieveContactTranscriptJob(job);
  }
};

const getCleanupRetentionDays = async (accountSid): Promise<number | undefined> =>
  (await getSsmParameter(
    `/${process.env.NODE_ENV}/hrm/jobs/${accountSid}/contact/cleanup-retention-days`,
  )) || MAX_CLEANUP_JOB_RETENTION_DAYS;

export const cleanupContactJobs = async (): Promise<void> => {
  const accountSids = await getPendingCleanupJobAccountSids(MAX_CLEANUP_JOB_RETENTION_DAYS);

  for (const accountSid of accountSids) {
    const cleanupRetentionDays = await getCleanupRetentionDays(accountSid);
    const pendingJobs = await getPendingCleanupJobs(accountSid, cleanupRetentionDays as number);

    for (const job of pendingJobs) {
      await cleanupContactJob(job);
    }
  }
};
