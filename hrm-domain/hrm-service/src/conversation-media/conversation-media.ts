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

import { S3ContactMediaType } from './conversation-media-data-access';

export {
  S3ContactMediaType,
  NewConversationMedia,
  ConversationMedia,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  isTwilioStoredMedia,
  create as createConversationMedia,
  getById as getConversationMediaById,
  getByContactId as getConversationMediaByContactId,
  updateSpecificData as updateConversationMediaData,
} from './conversation-media-data-access';

/** Legacy types, used until everything is migrated */
export type LegacyTwilioStoredMedia = {
  store: 'twilio';
  reservationSid: string;
};

export type LegacyS3StoredTranscript = {
  store: 'S3';
  type: S3ContactMediaType.TRANSCRIPT;
  location?: {
    bucket: string;
    key: string;
  };
};

type LegacyS3StoredMedia = LegacyS3StoredTranscript;

export type LegacyConversationMedia = LegacyTwilioStoredMedia | LegacyS3StoredMedia;
/** */
