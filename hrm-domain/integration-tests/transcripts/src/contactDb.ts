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

import { Contact, NewContactRecord } from '@tech-matters/hrm-types/Contact';
import { ITask } from 'pg-promise';
import { INSERT_CONTACT_SQL } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { db } from './connectionPool';
import { ACCOUNT_SID } from './fixtures/sampleConfig';
import {
  ConversationMedia,
  NewConversationMedia,
  S3ContactMediaType,
  S3StoredConversationMedia,
} from '@tech-matters/hrm-types/ConversationMedia';
import { insertConversationMediaSql } from '@tech-matters/hrm-core/conversation-media/sql/conversation-media-insert-sql';
import {
  insertIdentifierSql,
  insertProfileSql,
} from '@tech-matters/hrm-core/profile/sql/profile-insert-sql';
import { ContactJob } from '@tech-matters/hrm-core/contact-job/contact-job-data-access';
import { pgp } from '@tech-matters/hrm-core/dbConnection';
import { ContactJobType } from '@tech-matters/types/ContactJob';
import { retryable } from './retryable';

type CreateResultRecord = Contact & { isNewRecord: boolean };

export const createContact = async (newContact: NewContactRecord): Promise<Contact> =>
  db.tx(async (conn: ITask<{ contact: Contact; isNewRecord: boolean }>) => {
    const now = new Date().toISOString();

    const identifier = await conn.one(() =>
      insertIdentifierSql({
        identifier: 'integration-test-identifier',
        createdBy: 'WK-integration-test-counselor',
        createdAt: now,
        updatedAt: now,
        accountSid: ACCOUNT_SID,
        updatedBy: null,
      }),
    );

    const profile = await conn.one(() =>
      insertProfileSql({
        name: 'integration-test-profile',
        createdBy: 'WK-integration-test-counselor',
        createdAt: now,
        updatedAt: now,
        accountSid: ACCOUNT_SID,
        updatedBy: null,
      }),
    );

    const { isNewRecord, ...created }: CreateResultRecord =
      await conn.one<CreateResultRecord>(INSERT_CONTACT_SQL, {
        ...newContact,
        definitionVersion: 'as-v1',
        identifierId: identifier.id,
        profileId: profile.id,
        accountSid: ACCOUNT_SID,
        createdAt: now,
        updatedAt: now,
      });

    return created;
  });

export const addConversationMediaToContact = async (
  conversationMedia: NewConversationMedia & { contactId: number },
): Promise<ConversationMedia> => {
  const now = new Date();
  const statement = insertConversationMediaSql({
    ...conversationMedia,
    accountSid: ACCOUNT_SID,
    createdAt: now,
    updatedAt: now,
  });
  return db.task(conn => conn.one(statement));
};

export const createDueRetrieveTranscriptJob = async (
  contact: Contact,
  conversationMediaId: number,
): Promise<ContactJob> => {
  const job: Omit<ContactJob, 'id' | 'resource'> = {
    requested: new Date().toISOString(),
    jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
    contactId: parseInt(contact.id),
    accountSid: ACCOUNT_SID,
    additionalPayload: {
      conversationMediaId,
    },
    lastAttempt: null,
    numberOfAttempts: 0,
    completed: null,
    completionPayload: null,
  };
  return db.task(async conn =>
    conn.one(() => `${pgp.helpers.insert(job, null, 'ContactJobs')} RETURNING *`),
  );
};

export const waitForConversationMedia = retryable(
  async ({
    contactId,
    mediaType,
  }: {
    contactId: number;
    mediaType: S3ContactMediaType;
  }): Promise<S3StoredConversationMedia | undefined> => {
    const media = await db.task(async conn => {
      return conn.oneOrNone(
        `SELECT * FROM "ConversationMedias" 
               WHERE 
                    "accountSid" = $<accountSid> AND
                    "contactId" = $<contactId> AND 
                    "storeType" = 'S3' AND 
                    "storeTypeSpecificData"->>'type' = $<mediaType>`,
        { contactId, accountSid: ACCOUNT_SID, mediaType },
      );
    });
    if (!media) {
      throw new Error('Media not found');
    }
    return media;
  },
);

export const waitForCompletedContactJob = retryable(
  async ({
    contactId,
    jobType,
  }: {
    contactId: number;
    jobType: ContactJobType;
  }): Promise<ContactJob | undefined> => {
    const job = await db.task(async conn =>
      conn.oneOrNone(
        `SELECT * FROM "ContactJobs" 
               WHERE 
                    "accountSid" = $<accountSid> AND
                    "contactId" = $<contactId> AND 
                    "jobType" = $<jobType> AND
                    "completed" IS NOT NULL`,
        { contactId, accountSid: ACCOUNT_SID, jobType },
      ),
    );

    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  },
);
