import { ContactJob, ContactJobType } from '../../src/contact-job/contact-job-data-access';
import { PublishToContactJobsTopicParams } from '@tech-matters/hrm-types/ContactJob';

export const getContactJobMock = (overrides: Partial<ContactJob> = {}): ContactJob => ({
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  jobId: 1,
  accountSid: 'accountSid',
  attemptNumber: 1,
  contactId: 123,
  taskId: 'taskId',
  twilioWorkerId: 'twilioWorkerId',
  serviceSid: 'serviceSid',
  channelSid: 'channelSid',
  filePath: 'filePath',
  ...overrides,
});
