import { S3 } from 'aws-sdk';
import type { ExportTranscriptResult } from './exportTranscript';

const s3Config = process.env.AWS_ENDPOINT_OVERRIDE
  ? {
      region: 'us-east-1',
      endpoint: process.env.AWS_ENDPOINT_OVERRIDE,
      s3ForcePathStyle: true,
    }
  : {};

const s3 = new S3(s3Config);

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
