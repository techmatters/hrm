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

import { format } from 'date-fns';
import {
  ContactJob,
  RetrieveContactTranscriptJob,
  ScrubContactTranscriptJob,
} from './contact-job-data-access';
import { postScrubTranscriptJob, publishToContactJobs } from './client-sqs';
import { assertExhaustive, ContactJobType } from '@tech-matters/types';

export const publishRetrieveContactTranscript = (
  contactJob: RetrieveContactTranscriptJob,
) => {
  const {
    accountSid,
    id: contactId,
    channelSid,
    serviceSid,
    taskId,
    twilioWorkerId,
    createdAt,
  } = contactJob.resource;

  const dateBasedPath = format(new Date(createdAt), 'yyyy/MM/dd/yyyyMMddHHmmss');
  const filePath = `transcripts/${dateBasedPath}-${taskId}.json`;

  return publishToContactJobs({
    jobType: contactJob.jobType,
    jobId: contactJob.id,
    accountSid,
    contactId,
    channelSid,
    serviceSid,
    taskId,
    twilioWorkerId,
    filePath,
    attemptNumber: contactJob.numberOfAttempts,
    conversationMediaId: contactJob.additionalPayload.conversationMediaId,
  });
};

type PublishedContactJobResult = Awaited<ReturnType<typeof publishToContactJobs>>;

export const publishScrubTranscriptJob = async (
  contactJob: ScrubContactTranscriptJob,
) => {
  const { accountSid, id: contactId, taskId, twilioWorkerId } = contactJob.resource;
  return publishToContactJobs({
    jobType: contactJob.jobType,
    jobId: contactJob.id,
    accountSid,
    contactId,
    taskId,
    twilioWorkerId,
    attemptNumber: contactJob.numberOfAttempts,
    originalLocation: contactJob.additionalPayload.originalLocation,
  });
};

export const publishDueContactJobs = async (
  dueContactJobs: ContactJob[],
): Promise<PromiseSettledResult<PublishedContactJobResult>[]> => {
  const publishedContactJobResult = await Promise.allSettled(
    dueContactJobs.map((dueJob: ContactJob) => {
      try {
        switch (dueJob.jobType) {
          case ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
            return publishRetrieveContactTranscript(dueJob);
          }
          case ContactJobType.SCRUB_CONTACT_TRANSCRIPT: {
            return postScrubTranscriptJob(dueJob);
          }
          // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
          default:
            assertExhaustive(dueJob as never);
        }
      } catch (err) {
        console.error(err, dueJob);
        return Promise.reject(err);
      }
    }),
  );

  return publishedContactJobResult;
};
