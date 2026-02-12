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
exports.updateSpecificData = exports.getByContactId = exports.getById = exports.create = exports.isS3StoredConversationMedia = exports.isS3StoredRecording = exports.isS3StoredTranscriptPending = exports.isS3StoredTranscript = exports.isTwilioStoredMedia = exports.S3ContactMediaType = void 0;
const referralDataAccess_1 = require("../referral/referralDataAccess");
const sql_1 = require("../sql");
const conversation_media_get_sql_1 = require("./sql/conversation-media-get-sql");
const conversation_media_insert_sql_1 = require("./sql/conversation-media-insert-sql");
const conversation_media_update_sql_1 = require("./sql/conversation-media-update-sql");
const hrm_types_1 = require("@tech-matters/hrm-types");
Object.defineProperty(exports, "S3ContactMediaType", { enumerable: true, get: function () { return hrm_types_1.S3ContactMediaType; } });
Object.defineProperty(exports, "isTwilioStoredMedia", { enumerable: true, get: function () { return hrm_types_1.isTwilioStoredMedia; } });
Object.defineProperty(exports, "isS3StoredTranscript", { enumerable: true, get: function () { return hrm_types_1.isS3StoredTranscript; } });
Object.defineProperty(exports, "isS3StoredTranscriptPending", { enumerable: true, get: function () { return hrm_types_1.isS3StoredTranscriptPending; } });
Object.defineProperty(exports, "isS3StoredRecording", { enumerable: true, get: function () { return hrm_types_1.isS3StoredRecording; } });
Object.defineProperty(exports, "isS3StoredConversationMedia", { enumerable: true, get: function () { return hrm_types_1.isS3StoredConversationMedia; } });
const dbConnection_1 = require("../dbConnection");
const create = (task) => async (accountSid, conversationMedia) => {
    try {
        const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
        const now = new Date();
        const statement = (0, conversation_media_insert_sql_1.insertConversationMediaSql)({
            ...conversationMedia,
            accountSid,
            createdAt: now,
            updatedAt: now,
        });
        return await (0, sql_1.txIfNotInOne)(db, task, conn => conn.one(statement));
    }
    catch (err) {
        const dbErr = (0, sql_1.inferPostgresError)(err);
        if (dbErr instanceof sql_1.DatabaseUniqueConstraintViolationError &&
            dbErr.constraint === 'ConversationMedias_pkey') {
            throw new referralDataAccess_1.DuplicateReferralError(dbErr);
        }
        if (dbErr instanceof sql_1.DatabaseForeignKeyViolationError &&
            dbErr.constraint === 'ConversationMedias_contactId_Contact_id_fk') {
            throw new referralDataAccess_1.OrphanedReferralError(conversationMedia.contactId.toString(), dbErr);
        }
        throw dbErr;
    }
};
exports.create = create;
const getById = async (accountSid, id) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.oneOrNone(conversation_media_get_sql_1.selectSingleConversationMediaByIdSql, {
    accountSid,
    id,
}));
exports.getById = getById;
const getByContactId = async (accountSid, contactId) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.manyOrNone(conversation_media_get_sql_1.selectConversationMediaByContactIdSql, {
    accountSid,
    contactId,
}));
exports.getByContactId = getByContactId;
/**
 * NOTE: This function should not be used, but via the wrapper exposed from contact service. This is because otherwise, no contact re-index will be triggered.
 */
const updateSpecificData = async (accountSid, id, storeTypeSpecificData) => (await (0, dbConnection_1.getDbForAccount)(accountSid)).task(async (connection) => connection.none(conversation_media_update_sql_1.updateSpecificDataByIdSql, {
    accountSid,
    id,
    storeTypeSpecificData,
}));
exports.updateSpecificData = updateSpecificData;
