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

import { db } from '../connection-pool';
import {
  DuplicateReferralError,
  OrphanedReferralError,
} from '../referral/referral-data-access';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  inferPostgresError,
  txIfNotInOne,
} from '../sql';
import {
  selectConversationMediaByContactIdSql,
  selectSingleConversationMediaByIdSql,
} from './sql/conversation-media-get-sql';
import { insertConversationMediaSql } from './sql/conversation-media-insert-sql';
import { updateSpecificDataByIdSql } from './sql/conversation-media-update-sql';

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
export type ConversationMedia =
  | TwilioStoredMedia
  | S3StoredTranscript
  | S3StoredRecording;

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

export const create =
  (task?) =>
  async (
    accountSid: string,
    conversationMedia: NewConversationMedia & { contactId: number },
  ): Promise<ConversationMedia> => {
    try {
      const now = new Date();
      const statement = insertConversationMediaSql({
        ...conversationMedia,
        accountSid,
        createdAt: now,
        updatedAt: now,
      });

      return await txIfNotInOne(task, conn => conn.one(statement));
    } catch (err) {
      const dbErr = inferPostgresError(err);
      if (
        dbErr instanceof DatabaseUniqueConstraintViolationError &&
        dbErr.constraint === 'ConversationMedias_pkey'
      ) {
        throw new DuplicateReferralError(dbErr);
      }
      if (
        dbErr instanceof DatabaseForeignKeyViolationError &&
        dbErr.constraint === 'ConversationMedias_contactId_Contact_id_fk'
      ) {
        throw new OrphanedReferralError(conversationMedia.contactId.toString(), dbErr);
      }
      throw dbErr;
    }
  };

export const getById = async (
  accountSid: string,
  id: number,
): Promise<ConversationMedia> =>
  db.task(async connection =>
    connection.oneOrNone<ConversationMedia>(selectSingleConversationMediaByIdSql, {
      accountSid,
      id,
    }),
  );

export const getByContactId = async (
  accountSid: string,
  contactId: number,
): Promise<ConversationMedia[]> =>
  db.task(async connection =>
    connection.manyOrNone<ConversationMedia>(selectConversationMediaByContactIdSql, {
      accountSid,
      contactId,
    }),
  );

export const updateSpecificData = async (
  accountSid: string,
  id: ConversationMedia['id'],
  storeTypeSpecificData: ConversationMedia['storeTypeSpecificData'],
): Promise<void> =>
  db.task(async connection =>
    connection.none(updateSpecificDataByIdSql, {
      accountSid,
      id,
      storeTypeSpecificData,
    }),
  );
