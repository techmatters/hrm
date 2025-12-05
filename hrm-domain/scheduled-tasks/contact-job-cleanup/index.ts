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
import { getSsmParameter, SsmParameterNotFound } from '@tech-matters/ssm-cache';
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
  ConversationMedia,
  getConversationMediaByContactId,
  getConversationMediaById,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
} from '@tech-matters/hrm-core/conversation-media/conversationMedia';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 3650;

/**
 * Delete the twilio channel associated with a completed transcript job
 *
 * @param job
 * @returns true if the channel was deleted, false if it was not
 */
const deleteTranscript = async (job: RetrieveContactTranscriptJob): Promise<boolean> => {
  const { accountSid, id, contactId } = job;
  const { channelSid } = job.resource;

  let conversationMediaId: ConversationMedia['id'];

  if (job.additionalPayload?.conversationMediaId) {
    conversationMediaId = job.additionalPayload.conversationMediaId;
  } else {
    const cms = await getConversationMediaByContactId(accountSid, contactId);
    const cm = cms.find(isS3StoredTranscript);

    if (cm) {
      conversationMediaId = cm.id;
    }
  }

  if (!conversationMediaId) return false;

  // Double check that the related contact has a transcript stored in S3
  const conversationMedia = await getConversationMediaById(
    accountSid,
    conversationMediaId,
  );

  if (
    !isS3StoredTranscript(conversationMedia) ||
    isS3StoredTranscriptPending(conversationMedia)
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
  const client = await getClient({ accountSid });
  try {
    await client.conversations.v1.conversations.get(job.resource.channelSid).remove();
  } catch (err) {
    if (err.status === 404) {
      console.info(
        `Conversation ${channelSid} not found, checking legacy chat API just in case.`,
      );
      try {
        await client.chat.v2
          .services(job.resource.serviceSid)
          .channels.get(job.resource.channelSid)
          .remove();
      } catch (chatError) {
        if (err.status === 404) {
          console.info(
            `${channelSid} not found as a chat channel or conversation, assuming it has already been deleted`,
          );
          return true;
        }
      }
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

  const { accountSid, id, jobType, contactId } = job;
  await deleteContactJob(accountSid, id);
  console.info(
    `Successfully cleaned up contact job ${id} (${jobType}) for contact ${contactId}`,
  );
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
    console.debug(
      `SSM parameter for transcript retention days set to ${ssmRetentionDays} for account ${accountSid}, so using that`,
    );
  } catch (err) {
    if ((err as any) instanceof SsmParameterNotFound) {
      console.debug(
        `SSM parameter for transcript retention days not set for account ${accountSid}, so using default ${MAX_CLEANUP_JOB_RETENTION_DAYS}`,
      );
    } else {
      console.error(
        `Error trying to fetch /${process.env.NODE_ENV}/hrm/${accountSid}/transcript_retention_days ${err}, using default`,
        err,
      );
    }
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

    console.info(`Cleaning up contact jobs for accounts:`, accountSids);

    for (const accountSid of accountSids) {
      console.info(`Cleaning up contact jobs for account:`, accountSid);
      const cleanupRetentionDays = await getCleanupRetentionDays(accountSid);
      const pendingJobs = await getPendingCleanupJobs(accountSid, cleanupRetentionDays);

      for (const job of pendingJobs) {
        try {
          await cleanupContactJob(job);
        } catch (err) {
          console.error(
            new ContactJobCleanupError(
              `Error processing job ${job.id} (contact: ${job.contactId}): ${err}`,
            ),
          );
        }
      }
    }
  } catch (err) {
    throw new ContactJobCleanupError(`Error cleaning up contact jobs: ${err}`);
  }
};
