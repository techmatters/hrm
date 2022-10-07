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

  export type RetrieveContactTranscriptCompleted = PublishRetrieveContactTranscript & {
    completionPayload: string;
  };
