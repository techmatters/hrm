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
exports.selectSingleContactJobByIdSql = exports.UPDATE_JOB_CLEANUP_PENDING_SQL = exports.UPDATE_JOB_CLEANUP_ACTIVE_SQL = exports.INCREMENT_JOBS_ATTEMPTS_SQL = exports.PULL_DUE_JOBS_SQL = exports.PENDING_CLEANUP_JOB_ACCOUNT_SIDS_SQL = exports.PENDING_CLEANUP_JOBS_SQL = exports.DELETE_JOB_SQL = exports.COMPLETE_JOB_SQL = exports.ADD_FAILED_ATTEMPT_PAYLOAD = exports.ContactJobCleanupStatus = void 0;
const contact_get_sql_1 = require("../../contact/sql/contact-get-sql");
var ContactJobCleanupStatus;
(function (ContactJobCleanupStatus) {
    ContactJobCleanupStatus["NOT_READY"] = "not_ready";
    ContactJobCleanupStatus["PENDING"] = "pending";
    ContactJobCleanupStatus["ACTIVE"] = "active";
    // COMPLETE = 'complete', this is not needed since the jobs are removed once they are "cleaned up"
})(ContactJobCleanupStatus || (exports.ContactJobCleanupStatus = ContactJobCleanupStatus = {}));
exports.ADD_FAILED_ATTEMPT_PAYLOAD = `
  INSERT INTO "ContactJobsFailures" ("contactJobId", "attemptNumber", "payload", "createdAt")
  VALUES ($<contactJobId>, $<attemptNumber>, $<attemptPayload:json>::JSONB, current_timestamp)
  RETURNING *
`;
exports.COMPLETE_JOB_SQL = `
  UPDATE "ContactJobs" SET
      "completed" = CURRENT_TIMESTAMP,
      "completionPayload" = $<completionPayload:json>::JSONB,
      "cleanupStatus" = $<cleanupStatus>
  WHERE "id" = $<id>
  RETURNING *
`;
exports.DELETE_JOB_SQL = `DELETE FROM "ContactJobs" WHERE id = $<jobId> AND "accountSid" = $<accountSid>`;
exports.PENDING_CLEANUP_JOBS_SQL = `
WITH due AS (
  SELECT * FROM "ContactJobs"
  WHERE
    "cleanupStatus" = '${ContactJobCleanupStatus.PENDING}'
    AND "accountSid" = $<accountSid>
    AND "completed" IS NOT NULL
    AND "completed" < (current_timestamp - interval '$<cleanupRetentionDays> day')
  )
  SELECT due.*, to_jsonb(contacts.*) AS "resource"
  FROM due LEFT JOIN LATERAL (
  ${(0, contact_get_sql_1.selectContactsWithRelations)('Contacts')} WHERE c."accountSid" = due."accountSid" AND c."id" = due."contactId") AS contacts ON true
`;
exports.PENDING_CLEANUP_JOB_ACCOUNT_SIDS_SQL = `
  SELECT DISTINCT "accountSid" FROM "ContactJobs"
  WHERE
    "cleanupStatus" = '${ContactJobCleanupStatus.PENDING}'
    AND "completed" IS NOT NULL
`;
exports.PULL_DUE_JOBS_SQL = `
  SELECT cj.*, to_jsonb(contacts.*) AS "resource"
  FROM "ContactJobs" as cj LEFT JOIN LATERAL (
  ${(0, contact_get_sql_1.selectContactsWithRelations)('Contacts')} WHERE c."accountSid" = cj."accountSid" AND c."id" = cj."contactId") AS contacts ON true
  WHERE cj."completed" IS NULL AND cj."numberOfAttempts" < $<jobMaxAttempts> AND (cj."lastAttempt" IS NULL OR cj."lastAttempt" <= $<lastAttemptedBefore>::TIMESTAMP WITH TIME ZONE)
`;
exports.INCREMENT_JOBS_ATTEMPTS_SQL = `
    UPDATE "ContactJobs" SET "lastAttempt" = CURRENT_TIMESTAMP, "numberOfAttempts" = "numberOfAttempts" + 1
    WHERE "id" IN ($<jobIds:csv>)
`;
exports.UPDATE_JOB_CLEANUP_ACTIVE_SQL = `
  UPDATE "ContactJobs"
  SET
    "lastCleanup" = CURRENT_TIMESTAMP,
    "cleanupStatus" = '${ContactJobCleanupStatus.ACTIVE}'
  WHERE
    "id" = $<jobId>
`;
exports.UPDATE_JOB_CLEANUP_PENDING_SQL = `
  UPDATE "ContactJobs"
  SET "cleanupStatus" = '${ContactJobCleanupStatus.PENDING}'
  WHERE
    "id" = $<jobId>
`;
const selectSingleContactJobByIdSql = (table) => `SELECT * FROM "${table}" WHERE id = $(jobId)`;
exports.selectSingleContactJobByIdSql = selectSingleContactJobByIdSql;
