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

import {
  appendFailedAttemptPayload,
  completeContactJob,
  ContactJobRecord,
  createContactJob,
  getContactJobById,
} from './contact-job-data-access';
import type {
  CompletedContactJobBody,
  CompletedContactJobBodyFailure,
  CompletedContactJobBodySuccess,
  CompletedRetrieveContactTranscript,
} from '@tech-matters/types';
import {
  assertExhaustive,
  CompletedScrubContactTranscript,
  ContactJobAttemptResult,
  ContactJobType,
} from '@tech-matters/types';
import {
  ContactJobCompleteProcessorError,
  ContactJobPollerError,
} from './contact-job-error';
import {
  deleteCompletedContactJobsFromQueue,
  pollCompletedContactJobsFromQueue,
} from './client-sqs';
import {
  ConversationMedia,
  createConversationMedia,
  updateConversationMediaSpecificData,
  getConversationMediaById,
  S3ContactMediaType,
} from '../conversation-media/conversation-media';
import { getById } from '../contact/contactDataAccess';
import { getByContactId } from '../conversation-media/conversation-media-data-access';
import { updateConversationMediaData } from '../contact/contactService';

export const processCompletedRetrieveContactTranscript = async (
  completedJob: CompletedRetrieveContactTranscript & {
    attemptResult: ContactJobAttemptResult.SUCCESS;
  },
) => {
  const conversationMedia = await getConversationMediaById(
    completedJob.accountSid,
    completedJob.conversationMediaId,
  );

  const storeTypeSpecificData: ConversationMedia['storeTypeSpecificData'] = {
    ...conversationMedia.storeTypeSpecificData,
    location: completedJob.attemptPayload,
  };

  await updateConversationMediaData(completedJob.contactId)(
    completedJob.accountSid,
    completedJob.conversationMediaId,
    storeTypeSpecificData,
  );

  const contact = await getById(completedJob.accountSid, completedJob.contactId);
  await createContactJob()({
    jobType: ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
    resource: contact,
    additionalPayload: {
      originalLocation: {
        bucket: completedJob.attemptPayload.bucket,
        key: completedJob.attemptPayload.key,
      },
    },
  });
};

export const processCompletedScrubContactTranscript = async (
  completedJob: CompletedScrubContactTranscript & {
    attemptResult: ContactJobAttemptResult.SUCCESS;
  },
) => {
  const conversationMedia = await getByContactId(
    completedJob.accountSid,
    completedJob.contactId,
  );

  const existingScrubbedMedia = conversationMedia.find(
    cm =>
      cm.storeType == 'S3' &&
      cm.storeTypeSpecificData.type === S3ContactMediaType.SCRUBBED_TRANSCRIPT,
  );
  if (existingScrubbedMedia) {
    const storeTypeSpecificData: ConversationMedia['storeTypeSpecificData'] = {
      ...existingScrubbedMedia.storeTypeSpecificData,
      location: completedJob.attemptPayload.scrubbedLocation,
    };

    // We don't want to reindex on a scrubbed transcript being added (yet);
    return updateConversationMediaSpecificData(
      completedJob.accountSid,
      existingScrubbedMedia.id,
      storeTypeSpecificData,
    );
  } else {
    return createConversationMedia()(completedJob.accountSid, {
      contactId: completedJob.contactId,
      storeType: 'S3',
      storeTypeSpecificData: {
        type: S3ContactMediaType.SCRUBBED_TRANSCRIPT,
        location: completedJob.attemptPayload.scrubbedLocation,
      },
    });
  }
};

export const processCompletedContactJob = async (
  completedJob: CompletedContactJobBodySuccess,
) => {
  switch (completedJob.jobType) {
    case ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
      return processCompletedRetrieveContactTranscript(completedJob);
    }
    case ContactJobType.SCRUB_CONTACT_TRANSCRIPT: {
      return processCompletedScrubContactTranscript(completedJob);
    }
    // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
    default:
      assertExhaustive(completedJob as never);
  }
};

export const getAttemptNumber = (
  completedJob: CompletedContactJobBody | CompletedContactJobBodyFailure,
  contactJob: ContactJobRecord,
) => completedJob.attemptNumber ?? contactJob.numberOfAttempts;

export const getContactJobOrFail = async (
  completedJob: CompletedContactJobBody | CompletedContactJobBodyFailure,
) => {
  const contactJob = await getContactJobById(completedJob.jobId);

  if (!contactJob) {
    // TODO: this should probably be a fatal error that short circuits the retry logic
    throw new Error(`Could not find contact job with id ${completedJob.jobId}`);
  }

  return contactJob;
};

export const handleSuccess = async (completedJob: CompletedContactJobBodySuccess) => {
  await processCompletedContactJob(completedJob);

  // Mark the job as completed
  const completionPayload = {
    message: 'Job processed successfully',
    value: completedJob.attemptPayload,
  };

  return completeContactJob({
    id: completedJob.jobId,
    completionPayload,
  });
};

export const handleFailure = async (
  completedJob: CompletedContactJobBodyFailure,
  jobMaxAttempts: number,
) => {
  const { jobId } = completedJob;
  let { attemptPayload } = completedJob;

  if (typeof attemptPayload !== 'string') {
    attemptPayload = "Message did not contain attemptPayload. Likely DLQ'd from lambda";
  }

  // emit an error to pick up in metrics since completed queue is our
  // DLQ. These may be duplicates of ContactJobProcessorErrors that have
  // already caused an alarm, but there is a chance of other errors ending up here.
  console.error(
    new ContactJobCompleteProcessorError(
      `process job with id ${jobId} failed`,
      attemptPayload,
    ),
  );

  const contactJob = await getContactJobOrFail(completedJob);
  const attemptNumber = getAttemptNumber(completedJob, contactJob);

  const updated = await appendFailedAttemptPayload(jobId, attemptNumber, attemptPayload);

  if (attemptNumber >= jobMaxAttempts) {
    const completionPayload = { message: 'Attempts limit reached' };
    return completeContactJob({
      id: completedJob.jobId,
      completionPayload,
      wasSuccessful: false,
    });
  }

  return updated;
};

export const pollAndProcessCompletedContactJobs = async (jobMaxAttempts: number) => {
  console.debug(`Checking for queued completed jobs to process`);
  const polledCompletedJobs = await pollCompletedContactJobsFromQueue();

  if (!polledCompletedJobs?.Messages) return;

  const { Messages: messages } = polledCompletedJobs;

  if (!Array.isArray(messages)) {
    throw new ContactJobPollerError(
      `polledCompletedJobs returned invalid messages format ${messages}`,
    );
  }
  console.debug(`Processing ${messages.length} completed jobs`);

  const completedJobs = await Promise.allSettled(
    messages.map(async m => {
      try {
        // Immediately handle the message deletion in case of error since poller
        // is responsible for retrying failed jobs.
        await deleteCompletedContactJobsFromQueue(m.ReceiptHandle);

        const completedJob: CompletedContactJobBody = JSON.parse(m.Body);

        if (completedJob.attemptResult === ContactJobAttemptResult.SUCCESS) {
          console.debug(`Processing successful job ${completedJob.jobId}, contact ${completedJob.contactId}`, completedJob);
          return await handleSuccess(completedJob);
        } else {
          console.debug(`Processing failed job ${completedJob.jobId}, contact ${completedJob.contactId}`, completedJob);
          return await handleFailure(completedJob, jobMaxAttempts);
        }
      } catch (err) {
        console.error(
          new ContactJobPollerError('Failed to process CompletedContactJobBody:'),
          m,
          err,
        );
        return Promise.reject(err);
      }
    }),
  );
  console.debug(`Processed ${messages.length} completed jobs`);

  return completedJobs;
};
