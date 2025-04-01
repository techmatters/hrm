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
import { HrmAccountId } from '@tech-matters/types';
import {
  S3ContactMediaType,
  S3StoredTranscript,
  S3StoredRecording,
  S3StoredConversationMedia,
  ConversationMedia,
  NewConversationMedia,
  isTwilioStoredMedia,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  isS3StoredRecording,
  isS3StoredConversationMedia,
} from '@tech-matters/hrm-types';

export {
  S3ContactMediaType,
  S3StoredTranscript,
  S3StoredRecording,
  S3StoredConversationMedia,
  ConversationMedia,
  NewConversationMedia,
  isTwilioStoredMedia,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  isS3StoredRecording,
  isS3StoredConversationMedia,
};

export const create =
  (task?) =>
  async (
    accountSid: HrmAccountId,
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

      return await txIfNotInOne(db, task, conn => conn.one(statement));
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
  accountSid: HrmAccountId,
  id: number,
): Promise<ConversationMedia> =>
  db.task(async connection =>
    connection.oneOrNone<ConversationMedia>(selectSingleConversationMediaByIdSql, {
      accountSid,
      id,
    }),
  );

export const getByContactId = async (
  accountSid: HrmAccountId,
  contactId: number,
): Promise<ConversationMedia[]> =>
  db.task(async connection =>
    connection.manyOrNone<ConversationMedia>(selectConversationMediaByContactIdSql, {
      accountSid,
      contactId,
    }),
  );

/**
 * NOTE: This function should not be used, but via the wrapper exposed from contact service. This is because otherwise, no contact re-index will be triggered.
 */
export const updateSpecificData = async (
  accountSid: HrmAccountId,
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
