import { format } from 'date-fns';
import { ContactJob, RetrieveContactTranscriptJob } from './contact-job-data-access';
import { publishToContactJobsTopic } from './client-sns';
import { ContactJobType } from './contact-job-data-access';
import { assertExhaustive } from './assertExhaustive';

const publishRetrieveContactTranscript = (contactJob: RetrieveContactTranscriptJob) => {
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

  return publishToContactJobsTopic({
    jobType: contactJob.jobType,
    jobId: contactJob.id,
    accountSid,
    contactId,
    channelSid,
    serviceSid,
    taskId,
    twilioWorkerId,
    filePath,
  });
};

type PublishedContactJobResult = Awaited<ReturnType<typeof publishToContactJobsTopic>>;

export const publishDueContactJobs = async (
  dueContactJobs: ContactJob[],
): Promise<PromiseSettledResult<PublishedContactJobResult>[]> => {
  const publishedContactJobResult = await Promise.allSettled(
    dueContactJobs.map((dueJob: ContactJob) => {
      switch (dueJob.jobType) {
        case ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT: {
          return publishRetrieveContactTranscript(dueJob);
        }
        // TODO: remove the as never typecast when we have 2 or more job types. TS complains if we remove it now.
        default:
          assertExhaustive(dueJob as never);
      }
    }),
  );

  return publishedContactJobResult;
};
