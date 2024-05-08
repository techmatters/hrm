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

import { HrmAccountId } from '@tech-matters/types';

type ConversationMediaCommons = {
  id: number;
  contactId: number;
  accountSid: HrmAccountId;
  createdAt: Date;
  updatedAt: Date;
};

export enum S3ContactMediaType {
  RECORDING = 'recording',
  TRANSCRIPT = 'transcript',
}

type NewTwilioStoredMedia = {
  storeType: 'twilio';
  storeTypeSpecificData: { reservationSid: string };
};
type TwilioStoredMedia = ConversationMediaCommons & NewTwilioStoredMedia;

type NewS3StoredTranscript = {
  storeType: 'S3';
  storeTypeSpecificData: {
    type: S3ContactMediaType.TRANSCRIPT;
    location?: {
      bucket: string;
      key: string;
    };
  };
};

type NewS3StoredRecording = {
  storeType: 'S3';
  storeTypeSpecificData: {
    type: S3ContactMediaType.RECORDING;
    location?: {
      bucket: string;
      key: string;
    };
  };
};
export type S3StoredTranscript = ConversationMediaCommons & NewS3StoredTranscript;
export type S3StoredRecording = ConversationMediaCommons & NewS3StoredRecording;
export type S3StoredConversationMedia = S3StoredTranscript | S3StoredRecording;

export type ConversationMedia = TwilioStoredMedia | S3StoredConversationMedia;

export type NewConversationMedia =
  | NewTwilioStoredMedia
  | NewS3StoredTranscript
  | NewS3StoredRecording;

export const isTwilioStoredMedia = (m: ConversationMedia): m is TwilioStoredMedia =>
  m.storeType === 'twilio';
export const isS3StoredTranscript = (m: ConversationMedia): m is S3StoredTranscript =>
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  m.storeType === 'S3' && m.storeTypeSpecificData?.type === S3ContactMediaType.TRANSCRIPT;
export const isS3StoredTranscriptPending = (m: ConversationMedia) =>
  isS3StoredTranscript(m) && !m.storeTypeSpecificData?.location;
export const isS3StoredRecording = (m: ConversationMedia): m is S3StoredRecording =>
  m.storeType === 'S3' && m.storeTypeSpecificData?.type === S3ContactMediaType.RECORDING;
export const isS3StoredConversationMedia = (
  m: ConversationMedia,
): m is S3StoredConversationMedia => isS3StoredTranscript(m) || isS3StoredRecording(m);
