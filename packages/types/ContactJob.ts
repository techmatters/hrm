/**
 * Discussion:
 *
 * The current contact-job-messages in hrm-services have significant dependency on types that are
 * internal to hrm-services. Do we want to extract those out without the dependencies? Or is there
 * a better way to do this?
 *
 * For now, I'm just duplicating those types here.
 */
export enum ContactJobType {
  RETRIEVE_CONTACT_TRANSCRIPT = 'retrieve-transcript',
}

type ContactJobMessageCommons = {
  jobId: number;
  accountSid: string;
  contactId: number;
  taskId: string;
  twilioWorkerId: string;
  attemptNumber: number;
};

//====== Message payloads to publish for pending contact jobs ======//

export type PublishRetrieveContactTranscript = ContactJobMessageCommons & {
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT;
  serviceSid: string;
  channelSid: string;
  filePath: string; // the file name as we want to save the transctipr in S3
};

export type PublishToContactJobsTopicParams = PublishRetrieveContactTranscript;

//====== Message payloads expected for the completed contact jobs ======//

type CompletedContactJobMessageCommons<TSuccess, TFailure> =
  | {
      attemptResult: 'success';
      attemptPayload: TSuccess;
    }
  | {
      attemptResult: 'failure';
      attemptPayload: TFailure;
    };

export type CompletedRetrieveContactTranscript = PublishRetrieveContactTranscript &
  CompletedContactJobMessageCommons<string, any>;

export type CompletedContactJobBody = CompletedRetrieveContactTranscript;
