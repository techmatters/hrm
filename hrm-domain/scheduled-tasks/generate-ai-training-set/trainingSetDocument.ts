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

import { TrainingSetContact } from './hrmdbAccess';
import { ExportTranscript } from '@tech-matters/hrm-types/ConversationMedia';
import { getS3Object } from '@tech-matters/s3-client';

export type TrainingSetDocument = {
  contactId: string;
  categories: Record<string, string[]>;
  messages: ExportTranscript['messages'];
};

const trainingSetDocument = (
  { contactId, categories }: TrainingSetContact,
  { messages }: ExportTranscript,
): TrainingSetDocument => ({
  contactId,
  categories,
  messages,
});

export const attachTranscript = async (
  trainingSetContact: TrainingSetContact,
  shortCode: string,
  sourceBucket?: string,
): Promise<TrainingSetDocument> => {
  const readBucket = sourceBucket || trainingSetContact.transcriptBucket;
  const readKey = sourceBucket
    ? `${shortCode.toLowerCase()}/${trainingSetContact.transcriptKey}`
    : trainingSetContact.transcriptKey;

  const transcriptDocJson = await getS3Object({
    key: readKey,
    bucket: readBucket,
  });
  const transcript: ExportTranscript = JSON.parse(transcriptDocJson).transcript;
  return trainingSetDocument(trainingSetContact, transcript);
};
