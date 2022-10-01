//TODO: Pull these from HRM
// Keep in sync with hrm
export type PublishRetrieveContactTranscript = {
  jobType: string;
  jobId: number;
  accountSid: string;
  contactId: number;
  taskId: string;
  twilioWorkerId: string;
  serviceSid: string;
  channelSid: string;
  filePath: string;
};

// Keep in sync with hrm
export type RetrieveContactTranscriptCompleted = PublishRetrieveContactTranscript & {
  completionPayload: string;
};
