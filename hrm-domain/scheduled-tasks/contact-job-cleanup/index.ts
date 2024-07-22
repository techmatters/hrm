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
import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  ContactJob,
  deleteContactJob,
  RetrieveContactTranscriptJob,
  getPendingCleanupJobs,
  getPendingCleanupJobAccountSids,
  setContactJobCleanupActive,
  setContactJobCleanupPending,
} from '@tech-matters/hrm-core/contact-job/contact-job-data-access';
import { ContactJobCleanupError } from '@tech-matters/hrm-core/contact-job/contact-job-error';
import {
  getConversationMediaById,
  isS3StoredTranscript,
} from '@tech-matters/hrm-core/conversation-media/conversation-media';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 3650;

/**
 * Delete the twilio channel associated with a completed transcript job
 *
 * @param job
 * @returns true if the channel was deleted, false if it was not
 */
const deleteTranscript = async (job: RetrieveContactTranscriptJob): Promise<boolean> => {
  const { accountSid, id } = job;
  const { channelSid } = job.resource;

  // Double check that the related contact has a transcript stored in S3
  const conversationMedia = await getConversationMediaById(
    accountSid,
    job.additionalPayload.conversationMediaId,
  );

  if (
    !isS3StoredTranscript(conversationMedia) ||
    !conversationMedia.storeTypeSpecificData.location
  ) {
    console.error(
      new ContactJobCleanupError(
        `job ${id} does not have a transcript stored in S3, skipping cleanup`,
      ),
    );
    await setContactJobCleanupPending(id);
    return false;
  }

  await setContactJobCleanupActive(id);
  try {
    const client = await getClient({ accountSid });
    await client.chat.v2
      .services(job.resource.serviceSid)
      .channels.get(job.resource.channelSid)
      .remove();
  } catch (err) {
    if (err.status === 404) {
      console.log(
        `Channel ${channelSid} not found, assuming it has already been deleted`,
      );
    } else {
      console.error(
        new ContactJobCleanupError(
          `Error cleaning up twilio channel ${channelSid} for job ${id}: ${err}`,
        ),
      );
      await setContactJobCleanupPending(id);
      return false;
    }
  }

  return true;
};

/**
 * Delete a contact job and any associated resources
 * @param job
 * @returns void
 * @throws ContactJobCleanupError
 */
const cleanupContactJob = async (job: ContactJob): Promise<void> => {
  if (job.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
    if (!(await deleteTranscript(job))) return;
  }

  const { accountSid, id } = job;
  await deleteContactJob(accountSid, id);
  console.log(`Successfully cleaned up contact job ${id}`);
};

/**
 * Get the number of days to retain cleanup jobs for a given account
 * @param accountSid
 * @returns number of days to retain cleanup jobs
 */
const getCleanupRetentionDays = async (accountSid): Promise<number | undefined> => {
  let ssmRetentionDays: number;
  try {
    ssmRetentionDays =
      parseInt(
        await getSsmParameter(
          `/${process.env.NODE_ENV}/hrm/${accountSid}/transcript_retention_days`,
        ),
      ) || MAX_CLEANUP_JOB_RETENTION_DAYS;
  } catch {
    ssmRetentionDays = MAX_CLEANUP_JOB_RETENTION_DAYS;
  }

  // For now we are limiting the retention days to 365 days for all jobs and allowing for a
  // global override on a per account basis. This may need to epand to be more granular in the
  // future.
  return Math.min(MAX_CLEANUP_JOB_RETENTION_DAYS, ssmRetentionDays);
};

/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws ContactJobCleanupError
 */
export const cleanupContactJobs = async (): Promise<void> => {
  try {
    const accountSids = await getPendingCleanupJobAccountSids();

    console.log(`Cleaning up contact jobs for accounts:`, accountSids);

    for (const accountSid of accountSids) {
      const cleanupRetentionDays = await getCleanupRetentionDays(accountSid);
      const pendingJobs = await getPendingCleanupJobs(accountSid, cleanupRetentionDays);

      for (const job of pendingJobs) {
        await cleanupContactJob(job);
      }
    }
  } catch (err) {
    throw new ContactJobCleanupError(`Error cleaning up contact jobs: ${err}`);
  }
};
