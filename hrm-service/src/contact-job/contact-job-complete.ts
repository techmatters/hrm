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
  ContactJobRecord,
  completeContactJob,
  getContactJobById,
} from './contact-job-data-access';
import { ContactJobAttemptResult, ContactJobType } from '@tech-matters/types';
import { ContactJobCompleteProcessorError, ContactJobPollerError } from './contact-job-error';
import {
  deleteCompletedContactJobsFromQueue,
  pollCompletedContactJobsFromQueue,
} from './client-sqs';
import {
  getContactById,
  updateConversationMedia,
  S3StoredTranscript,
  isS3StoredTranscriptPending,
} from '../contact/contact';

import { assertExhaustive } from './assertExhaustive';

// eslint-disable-next-line prettier/prettier
import type {
  CompletedContactJobBody,
  CompletedContactJobBodyFailure,
  CompletedContactJobBodySuccess,
  CompletedRetrieveContactTranscript,
} from '@tech-matters/types';

export const processCompletedRetrieveContactTranscript = async (
  completedJob: CompletedRetrieveContactTranscript,
) => {
  const contact = await getContactById(completedJob.accountSid, completedJob.contactId);
  const { conversationMedia } = contact.rawJson;

  const transcriptEntryIndex = conversationMedia?.findIndex(isS3StoredTranscriptPending);

  if (transcriptEntryIndex < 0) {
    throw new ContactJobPollerError(
      `Contact with id ${contact.id} does not have a pending transcript entry in conversationMedia`,
    );
  }

  (<S3StoredTranscript>conversationMedia[transcriptEntryIndex]).location = completedJob.attemptPayload;
  (<S3StoredTranscript>conversationMedia[transcriptEntryIndex]).url = completedJob.attemptPayload.url;

  return updateConversationMedia(
    completedJob.accountSid,
    completedJob.contactId,
    conversationMedia,
  );
};

export const processCompletedContactJob = async (completedJob: CompletedContactJobBody) => {
  switch (completedJob.jobType) {
    case ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
      return processCompletedRetrieveContactTranscript(completedJob);
    }
    // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
    default:
      assertExhaustive(completedJob as never);
  }
};

export const getAttemptNumber = (completedJob: CompletedContactJobBody, contactJob: ContactJobRecord) =>  completedJob.attemptNumber ?? contactJob.numberOfAttempts;

export const getContactJobOrFail = async (completedJob: CompletedContactJobBody) => {
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
  const markedComplete = await completeContactJob(completedJob.jobId, completionPayload);

  return markedComplete;
};

export const handleFailure = async (completedJob: CompletedContactJobBodyFailure, jobMaxAttempts: number) => {

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
    const markedComplete = await completeContactJob(completedJob.jobId, completionPayload, false);

    return markedComplete;
  }

  return updated;
};

export const pollAndProcessCompletedContactJobs = async (jobMaxAttempts: number) => {
  const polledCompletedJobs = await pollCompletedContactJobsFromQueue();

  if (!polledCompletedJobs?.Messages) return;

  const { Messages: messages } = polledCompletedJobs;

  if (!Array.isArray(messages)) {
    throw new ContactJobPollerError(`polledCompletedJobs returned invalid messages format ${messages}`);
  }

  const completedJobs = await Promise.allSettled(
    messages.map(async m => {
      try {
        // Immediately handle the message deletion in case of error since poller
        // is responsible for retrying failed jobs.
        await deleteCompletedContactJobsFromQueue(m.ReceiptHandle);

        const completedJob: CompletedContactJobBody = JSON.parse(m.Body);

        if (completedJob.attemptResult === ContactJobAttemptResult.SUCCESS) {
          return await handleSuccess(completedJob);
        } else {
          return await handleFailure(completedJob, jobMaxAttempts);
        }
      } catch (err) {
        console.error(new ContactJobPollerError('Failed to process CompletedContactJobBody:'), m, err);
        return Promise.reject(err);
      }
    }),
  );

  return completedJobs;
};
