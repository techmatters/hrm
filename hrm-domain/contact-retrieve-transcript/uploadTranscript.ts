/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { s3 } from '@tech-matters/hrm-s3-client';

// eslint-disable-next-line prettier/prettier
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
