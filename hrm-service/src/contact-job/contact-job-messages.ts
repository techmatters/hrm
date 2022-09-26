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

export type PublishTestContactJob = ContactJobMessageCommons & {
  jobType: ContactJobType.TEST_CONTACT_JOB;
};

export type PublishToContactJobsTopicParams = PublishTestContactJob;

//====== Message payloads expected for the completed contact jobs ======//

export type TestContactJobCompleted = PublishTestContactJob & {
  completionPayload: string;
};

export type CompletedContactJobBody = TestContactJobCompleted;
