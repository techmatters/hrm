"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForCompletedContactJob = exports.waitForConversationMedia = exports.createDueRetrieveTranscriptJob = exports.addConversationMediaToContact = exports.createContact = void 0;
const contactInsertSql_1 = require("@tech-matters/hrm-core/contact/sql/contactInsertSql");
const connectionPool_1 = require("./connectionPool");
const sampleConfig_1 = require("./fixtures/sampleConfig");
const conversation_media_insert_sql_1 = require("@tech-matters/hrm-core/conversation-media/sql/conversation-media-insert-sql");
const profile_insert_sql_1 = require("@tech-matters/hrm-core/profile/sql/profile-insert-sql");
const dbConnection_1 = require("@tech-matters/hrm-core/dbConnection");
const ContactJob_1 = require("@tech-matters/types/ContactJob");
const retryable_1 = require("./retryable");
const createContact = async (newContact) => connectionPool_1.db.tx(async (conn) => {
    const now = new Date().toISOString();
    const identifier = await conn.one(() => (0, profile_insert_sql_1.insertIdentifierSql)({
        identifier: 'integration-test-identifier',
        createdBy: 'WK-integration-test-counselor',
        createdAt: now,
        updatedAt: now,
        accountSid: sampleConfig_1.ACCOUNT_SID,
        updatedBy: null,
    }));
    const profile = await conn.one(() => (0, profile_insert_sql_1.insertProfileSql)({
        name: 'integration-test-profile',
        definitionVersion: 'as-v1',
        createdBy: 'WK-integration-test-counselor',
        createdAt: now,
        updatedAt: now,
        accountSid: sampleConfig_1.ACCOUNT_SID,
        updatedBy: null,
    }));
    const { isNewRecord, ...created } = await conn.one(contactInsertSql_1.INSERT_CONTACT_SQL, {
        ...newContact,
        definitionVersion: 'as-v1',
        identifierId: identifier.id,
        profileId: profile.id,
        accountSid: sampleConfig_1.ACCOUNT_SID,
        createdAt: now,
        updatedAt: now,
    });
    return created;
});
exports.createContact = createContact;
const addConversationMediaToContact = async (conversationMedia) => {
    const now = new Date();
    const statement = (0, conversation_media_insert_sql_1.insertConversationMediaSql)({
        ...conversationMedia,
        accountSid: sampleConfig_1.ACCOUNT_SID,
        createdAt: now,
        updatedAt: now,
    });
    return connectionPool_1.db.task(conn => conn.one(statement));
};
exports.addConversationMediaToContact = addConversationMediaToContact;
const createDueRetrieveTranscriptJob = async (contact, conversationMediaId) => {
    const job = {
        requested: new Date().toISOString(),
        jobType: ContactJob_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        contactId: parseInt(contact.id),
        accountSid: sampleConfig_1.ACCOUNT_SID,
        additionalPayload: {
            conversationMediaId,
        },
        lastAttempt: null,
        numberOfAttempts: 0,
        completed: null,
        completionPayload: null,
    };
    return connectionPool_1.db.task(async (conn) => conn.one(() => `${dbConnection_1.pgp.helpers.insert(job, null, 'ContactJobs')} RETURNING *`));
};
exports.createDueRetrieveTranscriptJob = createDueRetrieveTranscriptJob;
exports.waitForConversationMedia = (0, retryable_1.retryable)(async ({ contactId, mediaType, }) => {
    const media = await connectionPool_1.db.task(async (conn) => {
        return conn.oneOrNone(`SELECT * FROM "ConversationMedias" 
               WHERE 
                    "accountSid" = $<accountSid> AND
                    "contactId" = $<contactId> AND 
                    "storeType" = 'S3' AND 
                    "storeTypeSpecificData"->>'type' = $<mediaType>`, { contactId, accountSid: sampleConfig_1.ACCOUNT_SID, mediaType });
    });
    if (!media) {
        throw new Error('Media not found');
    }
    return media;
});
exports.waitForCompletedContactJob = (0, retryable_1.retryable)(async ({ contactId, jobType, }) => {
    const job = await connectionPool_1.db.task(async (conn) => conn.oneOrNone(`SELECT * FROM "ContactJobs" 
               WHERE 
                    "accountSid" = $<accountSid> AND
                    "contactId" = $<contactId> AND 
                    "jobType" = $<jobType> AND
                    "completed" IS NOT NULL`, { contactId, accountSid: sampleConfig_1.ACCOUNT_SID, jobType }));
    if (!job) {
        throw new Error('Job not found');
    }
    return job;
});
