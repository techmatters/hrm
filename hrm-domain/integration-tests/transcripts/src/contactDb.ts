import { Contact, NewContactRecord } from '@tech-matters/hrm-types/Contact';
import { ITask } from 'pg-promise';
import { INSERT_CONTACT_SQL } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { db } from './connectionPool';
import { ACCOUNT_SID } from './fixtures/sampleConfig';
import {
  ConversationMedia,
  NewConversationMedia,
} from '@tech-matters/hrm-types/ConversationMedia';
import { insertConversationMediaSql } from '@tech-matters/hrm-core/conversation-media/sql/conversation-media-insert-sql';

type CreateResultRecord = Contact & { isNewRecord: boolean };

export const createContact = async (newContact: NewContactRecord): Promise<Contact> =>
  db.tx(async (conn: ITask<{ contact: Contact; isNewRecord: boolean }>) => {
    const now = new Date();
    const { isNewRecord, ...created }: CreateResultRecord =
      await conn.one<CreateResultRecord>(INSERT_CONTACT_SQL, {
        ...newContact,
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
