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

/**
 * Legacy types, used until everything is migrated
 */

export type LegacyTwilioStoredMedia = {
  store: 'twilio';
  reservationSid: string;
};

export type LegacyS3StoredTranscript = {
  store: 'S3';
  type: S3ContactMediaType.TRANSCRIPT;
  location?: string;
  url?: string;
};

type LegacyS3StoredMedia = LegacyS3StoredTranscript;

export type LegacyConversationMedia = LegacyTwilioStoredMedia | LegacyS3StoredMedia;

/**
 *
 */
type ConversationMediaCommons = {
  id: number;
  contactId: number;
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
};

export enum S3ContactMediaType {
  // RECORDING = 'recording',
  TRANSCRIPT = 'transcript',
}

type TwilioStoredMedia = ConversationMediaCommons & {
  storeType: 'twilio';
  storeTypeSpecificData: { reservationSid: string };
};
type S3StoredTranscript = ConversationMediaCommons & {
  storeType: 'S3';
  storeTypeSpecificData: {
    type: S3ContactMediaType.TRANSCRIPT;
    location?: string;
    url?: string;
  };
};
export type ConversationMedia = TwilioStoredMedia | S3StoredTranscript;

export const isTwilioStoredMedia = (m: ConversationMedia): m is TwilioStoredMedia =>
  m.storeType === 'twilio';
export const isS3StoredTranscript = (m: ConversationMedia): m is S3StoredTranscript =>
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  m.storeType === 'S3' && m.storeTypeSpecificData?.type === S3ContactMediaType.TRANSCRIPT;
export const isS3StoredTranscriptPending = (m: ConversationMedia) =>
  isS3StoredTranscript(m) && !m.storeTypeSpecificData?.location;
