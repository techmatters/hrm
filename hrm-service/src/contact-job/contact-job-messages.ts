import { Contact } from '../contact/contact-data-access';
import { ContactJob, ContactJobType } from './contact-job-data-access';

type ContactJobMessageCommons = {
  jobId: ContactJob['id'];
  accountSid: Contact['accountSid'];
  contactId: Contact['id'];
  taskId: Contact['taskId'];
  twilioWorkerId: Contact['twilioWorkerId'];
};

//====== Message payloads to publish for pending contact jobs ======//

export type PublishRetrieveContactTranscript = ContactJobMessageCommons & {
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT;
  serviceSid: Contact['serviceSid'];
  channelSid: Contact['channelSid'];
  filePath: string; // the file name as we want to save the transctipr in S3
};

export type PublishToContactJobsTopicParams = PublishRetrieveContactTranscript;

//====== Message payloads expected for the completed contact jobs ======//

export type CompletedRetrieveContactTranscript = PublishRetrieveContactTranscript & {
  completionPayload: string;
};

export type CompletedContactJobBody = CompletedRetrieveContactTranscript;
