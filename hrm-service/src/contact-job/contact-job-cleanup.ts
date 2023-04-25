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

import { ContactJobType } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import RestException from 'twilio/lib/base/RestException';
import { getSsmParameter } from '../config/ssmCache';
import {
  deleteContactJob,
  RetrieveContactTranscriptJob,
  getPendingCleanupJobs,
  getPendingCleanupJobAccountSids,
  setContactJobCleanupActive,
  setContactJobCleanupPending,
} from './contact-job-data-access';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 365;

export const cleanupTranscript = async (job: RetrieveContactTranscriptJob): Promise<boolean> => {
  const { accountSid, id } = job;
  const { channelSid } = job.resource;
  await setContactJobCleanupActive(id);
  const client = await getClient({ accountSid });
  try {
    await client.chat.v2
      .services(job.resource.serviceSid)
      .channels(job.resource.channelSid)
      .remove();
  } catch (err) {
    if (err instanceof RestException && err.status === 404) {
      console.log(`Channel ${channelSid} not found, assuming it has already been deleteed`);
    } else {
      console.error(`Error cleaning up twilio channel ${channelSid} for job ${id}: ${err}`);
      await setContactJobCleanupPending(id);
      return false;
    }
  }

  return true;
};

export const cleanupContactJob = async (job: RetrieveContactTranscriptJob): Promise<void> => {
  if (job.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
    if (!(await cleanupTranscript(job))) return;
  }

  const { accountSid, id } = job;
  await deleteContactJob(accountSid, id);
  console.log(`Successfully cleaned up contact job ${id}`);
};

const getCleanupRetentionDays = async (accountSid): Promise<number | undefined> => {
  let ssmRetentionDays: number;
  try {
    ssmRetentionDays =
      parseInt(await getSsmParameter(`/twilio/${accountSid}/cleanupJobRetentionDays`)) ||
      MAX_CLEANUP_JOB_RETENTION_DAYS;
  } catch {
    ssmRetentionDays = MAX_CLEANUP_JOB_RETENTION_DAYS;
  }

  return Math.min(MAX_CLEANUP_JOB_RETENTION_DAYS, ssmRetentionDays);
};

export const cleanupContactJobs = async (): Promise<void> => {
  const accountSids = await getPendingCleanupJobAccountSids(MAX_CLEANUP_JOB_RETENTION_DAYS);

  for (const accountSid of accountSids) {
    const cleanupRetentionDays = await getCleanupRetentionDays(accountSid);
    const pendingJobs = await getPendingCleanupJobs(accountSid, cleanupRetentionDays);

    for (const job of pendingJobs) {
      await cleanupContactJob(job);
    }
  }
};
