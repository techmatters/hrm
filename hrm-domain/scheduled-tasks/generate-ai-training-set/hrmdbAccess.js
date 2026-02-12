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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamTrainingSetContacts = void 0;
const pg_query_stream_1 = __importDefault(require("pg-query-stream"));
const dbConnection_1 = require("@tech-matters/hrm-core/dbConnection");
const HIGH_WATER_MARK = 1000;
const SELECT_CATEGORIES_SUMMARY_AND_TRANSCRIPTS_SQL = `
  SELECT
    c."id" AS "contactId",
    c."rawJson"->'categories' AS "categories",
    c."rawJson"->'caseInformation'->>'callSummary' AS "summary",
    cm."storeTypeSpecificData",
    cm."storeTypeSpecificData"->'location'->>'bucket' AS "transcriptBucket",
    cm."storeTypeSpecificData"->'location'->>'key' AS "transcriptKey"
  FROM
    "Contacts" AS c INNER JOIN "ConversationMedias" AS cm ON c."id" = cm."contactId" AND c."accountSid" = cm."accountSid"
  WHERE 
  c."accountSid" = $<accountSid> AND 
  (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(c."rawJson"->'categories', '{}'::jsonb))) > 0 AND 
  COALESCE(c."rawJson"->'caseInformation'->>'callSummary', '') <> '' AND
  cm."storeType" = 'S3' AND 
  cm."storeTypeSpecificData"->>'type' = 'transcript' AND
  cm."storeTypeSpecificData"->>'location' IS NOT NULL
`;
const streamTrainingSetContacts = async (accountSid) => {
    const formattedQuery = dbConnection_1.pgp.as.format(SELECT_CATEGORIES_SUMMARY_AND_TRANSCRIPTS_SQL, {
        accountSid,
    });
    const qs = new pg_query_stream_1.default(formattedQuery, [], { highWaterMark: HIGH_WATER_MARK });
    // Expose the readable stream to the caller as a promise for further pipelining
    const db = await Promise.resolve((0, dbConnection_1.getDbForAdmin)());
    return new Promise((resolve, reject) => {
        db.stream(qs, resultStream => {
            resolve(resultStream);
        }).catch(error => {
            console.error('Error streaming contacts:', error);
            reject(error);
        });
    });
};
exports.streamTrainingSetContacts = streamTrainingSetContacts;
