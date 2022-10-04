import { S3 } from 'aws-sdk';
import {
  PublishRetrieveContactTranscript,
  RetrieveContactTranscriptCompleted,
} from 'hrm-lib/types/ContactJob';

const s3 = new S3();

export type UploadTranscriptParams = {
  transcript: object; //TODO: finish defining this type in exportTranscript.ts
  docsBucketName: string;
  accountSid: string;
  contactId: number;
  taskId: string;
  twilioWorkerId: string;
  serviceSid: string;
  channelSid: string;
};

export const uploadTranscript = async ({
  transcript,
  docsBucketName,
  accountSid,
  contactId,
  taskId,
  twilioWorkerId,
  serviceSid,
  channelSid,
}: UploadTranscriptParams) => {
  //TODO: what is standard for this path?
  const filePath = '/what/should/this/be';

  const uploadResult = await s3
    .upload({
      Bucket: docsBucketName,
      Key: filePath,
      Body: JSON.stringify({
        transcript,
        accountSid,
        contactId,
        taskId,
        twilioWorkerId,
        serviceSid,
        channelSid,
      }),
    })
    .promise();

  return uploadResult;
};
