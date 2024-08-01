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

import type { WorkerSID } from '.';
import { HrmAccountId } from './HrmAccountId';

export enum ContactJobType {
  RETRIEVE_CONTACT_TRANSCRIPT = 'retrieve-transcript',
  SCRUB_CONTACT_TRANSCRIPT = 'scrub-transcript',
}

type ContactJobMessageCommons = {
  jobId: number;
  accountSid: HrmAccountId;
  contactId: number;
  taskId: string;
  twilioWorkerId: WorkerSID;
  attemptNumber: number;
};

//====== Message payloads to publish for pending contact jobs ======//

export type PublishRetrieveContactTranscript = ContactJobMessageCommons & {
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT;
  serviceSid: string;
  channelSid: string;
  filePath: string; // the file name as we want to save the transcript in S3
  conversationMediaId: number;
};

export type PublishToContactJobsTopicParams = PublishRetrieveContactTranscript;

//====== Message payloads expected for the completed contact jobs ======//

type CompleteRetrieveContactTranscriptTSuccess = {
  bucket: string;
  key: string;
};
export enum ContactJobAttemptResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

type CompletedContactJobMessageCommons<TSuccess, TFailure> =
  | {
      attemptResult: ContactJobAttemptResult.SUCCESS;
      attemptPayload: TSuccess;
    }
  | {
      attemptResult: ContactJobAttemptResult.FAILURE;
      attemptPayload: TFailure;
    };

export type CompletedRetrieveContactTranscript = PublishRetrieveContactTranscript &
  CompletedContactJobMessageCommons<CompleteRetrieveContactTranscriptTSuccess, any>;

export type CompletedContactJobBody = CompletedRetrieveContactTranscript;

export type CompletedContactJobBodySuccess = CompletedContactJobBody & {
  attemptResult: ContactJobAttemptResult.SUCCESS;
};
export type CompletedContactJobBodyFailure = Omit<
  CompletedContactJobBody,
  'attemptResult'
> & {
  attemptResult: ContactJobAttemptResult.FAILURE;
};
