import { s3 } from '@tech-matters/hrm-s3-client';
import type { ExportTranscriptResult } from './exportTranscript';

export type UploadTranscriptParams = {
  transcript: ExportTranscriptResult;
  docsBucketName: string;
  accountSid: string;
  contactId: number;
  filePath: string;
  taskId: string;
  twilioWorkerId: string;
  serviceSid: string;
  channelSid: string;
};

export type UploadTranscriptReturn = {};

export const uploadTranscript = async ({
  transcript,
  docsBucketName,
  accountSid,
  contactId,
  filePath,
  taskId,
  twilioWorkerId,
  serviceSid,
  channelSid,
}: UploadTranscriptParams) => {
  console.log('docsBucketName', docsBucketName);
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
