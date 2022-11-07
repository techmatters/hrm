import { format } from 'date-fns';
import { ContactJob, RetrieveContactTranscriptJob } from './contact-job-data-access';
import { publishToContactJobs } from './client-sqs';
import { ContactJobType } from './contact-job-data-access';
import { assertExhaustive } from './assertExhaustive';

export const publishRetrieveContactTranscript = (contactJob: RetrieveContactTranscriptJob) => {
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
  });
};

type PublishedContactJobResult = Awaited<ReturnType<typeof publishToContactJobs>>;

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
          // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
          default:
            assertExhaustive(dueJob as never);
        }
      } catch (err) {
        console.error('Failed to publish due job:', dueJob, err);
        return Promise.reject(err);
      }
    }),
  );

  return publishedContactJobResult;
};
